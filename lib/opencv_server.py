"""
FastAPI microservice wrapping FUNDAEValidator.
Receives a PDF URL (Vercel Blob), converts page to PNG, runs OpenCV validation.

Run: uvicorn lib.opencv_server:app --host 0.0.0.0 --port 8100
"""

import os
import sys
import time
import tempfile
from pathlib import Path

import httpx
import fitz  # pymupdf
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

# Add parent dir so we can import the validator
sys.path.insert(0, str(Path(__file__).parent))
from fundae_opencv_validator import FUNDAEValidator, validate_fundae_page

app = FastAPI(title="FUNDAE OpenCV Validator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

validator = FUNDAEValidator()


class ValidateRequest(BaseModel):
    pdf_url: str
    page_index: int = 1  # 0-based, default page 2
    dpi: int = 200
    gemini_data: Optional[Dict[str, Any]] = None


class ValidateResponse(BaseModel):
    total_checkboxes: int
    total_rows: int
    marked: int
    empty: int
    uncertain: int
    processing_time_ms: float
    checkboxes: list
    comparison: Optional[Dict[str, Any]] = None


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "fundae-opencv-validator",
        "timestamp": time.time(),
    }


@app.post("/validate")
async def validate(req: ValidateRequest):
    tmp_pdf = None
    tmp_png_path = None

    try:
        # 1. Download PDF from URL
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(req.pdf_url)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to download PDF: HTTP {resp.status_code}",
                )

        # 2. Save to temp file
        tmp_pdf = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp_pdf.write(resp.content)
        tmp_pdf.close()

        # 3. Convert page to PNG with pymupdf
        doc = fitz.open(tmp_pdf.name)
        if req.page_index >= len(doc):
            doc.close()
            raise HTTPException(
                status_code=400,
                detail=f"Page index {req.page_index} out of range (PDF has {len(doc)} pages)",
            )

        page = doc[req.page_index]
        pix = page.get_pixmap(dpi=req.dpi)
        tmp_png_path = os.path.join(tempfile.gettempdir(), f"opencv_{os.getpid()}_{time.time_ns()}.png")
        pix.save(tmp_png_path)
        doc.close()

        # 4. Run OpenCV validator
        result = validator.validate_page(tmp_png_path)

        # 5. Build response
        import json
        result_dict = json.loads(validator.to_json(result))

        # 6. Compare with Gemini if provided
        comparison = None
        if req.gemini_data:
            comparison = validator.compare_with_gemini(result, req.gemini_data)
            result_dict["comparison"] = comparison

        return result_dict

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup temp files
        if tmp_pdf and os.path.exists(tmp_pdf.name):
            os.unlink(tmp_pdf.name)
        if tmp_png_path and os.path.exists(tmp_png_path):
            os.unlink(tmp_png_path)


if __name__ == "__main__":
    uvicorn.run(
        "opencv_server:app",
        host="0.0.0.0",
        port=8100,
        reload=True,
    )
