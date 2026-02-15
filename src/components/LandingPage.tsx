import React from 'react';

interface LandingPageProps {
  isLightMode: boolean;
  onAccess: () => void;
}

export function LandingPage({ isLightMode, onAccess }: LandingPageProps) {
  const bg = isLightMode ? '#f0f9ff' : '#0f172a';
  const cardBg = isLightMode ? '#ffffff' : '#1e293b';
  const textColor = isLightMode ? '#0f172a' : '#e2e8f0';
  const mutedColor = isLightMode ? '#64748b' : '#94a3b8';
  const borderColor = isLightMode ? '#e2e8f0' : '#334155';
  const accentBlue = '#3b82f6';

  const features = [
    {
      icon: '📄',
      title: 'Extracción masiva con IA',
      description: 'PDFs, imágenes, manuscritos, audio. Hasta 500 documentos simultáneos con agente IA incorporado.'
    },
    {
      icon: '🔍',
      title: 'Pregunta al documento',
      description: 'Consulta toda tu colección documental en lenguaje natural. Búsqueda semántica con RAG avanzado.'
    },
    {
      icon: '✍️',
      title: 'Reconocimiento HTR',
      description: 'Lectura de manuscritos y documentos históricos con reconocimiento de escritura manual.'
    },
    {
      icon: '✅',
      title: 'Validación inteligente',
      description: 'Validación automática de CIF, NIF, fechas, importes. Cruce con Excel de referencia.'
    },
    {
      icon: '🌍',
      title: '9 idiomas europeos',
      description: 'Castellano, catalán, gallego, euskera, portugués, francés, inglés, italiano y alemán.'
    },
    {
      icon: '🎙️',
      title: 'Entrada y salida por voz',
      description: 'Consulta tus documentos por voz y recibe respuestas habladas en cualquier idioma.'
    },
    {
      icon: '⚡',
      title: 'Procesamiento por lotes',
      description: 'Cientos de documentos en paralelo con seguimiento en tiempo real y exportación consolidada.'
    },
    {
      icon: '🤖',
      title: 'Asistente Laia 24/7',
      description: 'Asistente virtual integrada que te guía en cada paso. Habla los 9 idiomas soportados.'
    }
  ];

  const stats = [
    { value: '500+', label: 'documentos simultáneos' },
    { value: '9', label: 'idiomas europeos' },
    { value: '100%', label: 'infraestructura UE' },
    { value: '24/7', label: 'disponibilidad' }
  ];

  const sectors = [
    'Administraciones públicas',
    'Gobiernos',
    'Archivos históricos',
    'Bibliotecas',
    'Universidades',
    'Sector sanitario',
    'Sector legal',
    'Corporaciones'
  ];

  return (
    <div style={{ backgroundColor: bg, color: textColor, minHeight: '100vh' }}>
      {/* Hero */}
      <header style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', color: 'white', fontWeight: 'bold'
            }}>V</div>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>VerbaDoc <span style={{ color: accentBlue }}>Pro</span></span>
          </div>
          <button
            onClick={onAccess}
            style={{
              padding: '0.625rem 1.5rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: 'white', border: 'none', borderRadius: '12px', fontSize: '0.9375rem',
              fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s'
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Acceder
          </button>
        </nav>

        <div style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto', padding: '2rem 0 4rem' }}>
          <div style={{
            display: 'inline-flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center'
          }}>
            <span style={{
              padding: '0.375rem 0.875rem', backgroundColor: isLightMode ? '#dbeafe' : '#1e3a5f',
              color: accentBlue, fontSize: '0.75rem', fontWeight: '700', borderRadius: '9999px',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              Prueba gratuita disponible
            </span>
            <span style={{
              padding: '0.375rem 0.875rem', backgroundColor: isLightMode ? '#d1fae5' : '#064e3b',
              color: '#10b981', fontSize: '0.75rem', fontWeight: '700', borderRadius: '9999px',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              100% Europeo
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: '800', lineHeight: '1.1', marginBottom: '1.5rem' }}>
            Plataforma de orquestación<br />documental con{' '}
            <span style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Inteligencia Artificial</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: mutedColor, maxWidth: '700px', margin: '0 auto 2.5rem', lineHeight: '1.7' }}>
            No es un simple OCR. VerbaDoc Pro <strong style={{ color: textColor }}>entiende</strong> tus documentos.
            Extrae datos masivamente, pregunta en lenguaje natural a toda tu colección y valida automáticamente la información.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onAccess}
              style={{
                padding: '0.875rem 2.5rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: 'white', border: 'none', borderRadius: '14px', fontSize: '1.0625rem',
                fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Probar gratis
            </button>
            <a
              href="https://www.mediasolam.eu"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0.875rem 2.5rem', backgroundColor: 'transparent',
                color: textColor, border: `2px solid ${borderColor}`, borderRadius: '14px',
                fontSize: '1.0625rem', fontWeight: '600', cursor: 'pointer',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center'
              }}
            >
              Más información
            </a>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section style={{ padding: '3rem 1rem', backgroundColor: isLightMode ? '#eff6ff' : '#0c1426' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', textAlign: 'center' }}>
          {stats.map((stat, i) => (
            <div key={i}>
              <div style={{
                fontSize: '2.5rem', fontWeight: '800',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>{stat.value}</div>
              <div style={{ color: mutedColor, fontSize: '0.9375rem' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '5rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: '800', marginBottom: '1rem' }}>
            Todo lo que necesitas en{' '}
            <span style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>una sola plataforma</span>
          </h2>
          <p style={{ color: mutedColor, fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
            Desde expedientes de 500 páginas hasta manuscritos históricos
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {features.map((f, i) => (
            <div key={i} style={{
              backgroundColor: cardBg, border: `1px solid ${borderColor}`,
              borderRadius: '16px', padding: '1.5rem', transition: 'transform 0.2s, box-shadow 0.2s'
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 25px ${isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.3)'}` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 style={{ fontWeight: '700', marginBottom: '0.5rem', fontSize: '1rem' }}>{f.title}</h3>
              <p style={{ color: mutedColor, fontSize: '0.875rem', lineHeight: '1.6' }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sectors */}
      <section style={{ padding: '4rem 1rem', backgroundColor: isLightMode ? '#eff6ff' : '#0c1426' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: '800', marginBottom: '1rem' }}>
            Soluciones para cualquier sector
          </h2>
          <p style={{ color: mutedColor, marginBottom: '2rem' }}>Tecnología de IA adaptada a las necesidades de cada industria</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
            {sectors.map((s, i) => (
              <span key={i} style={{
                padding: '0.5rem 1.25rem', backgroundColor: cardBg,
                border: `1px solid ${borderColor}`, borderRadius: '9999px',
                fontSize: '0.875rem', fontWeight: '500'
              }}>{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          backgroundColor: cardBg, border: `1px solid ${borderColor}`,
          borderRadius: '20px', padding: '3rem 2rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
              <div style={{ fontWeight: '700', fontSize: '0.9375rem' }}>Seguridad empresarial</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
              <div style={{ fontWeight: '700', fontSize: '0.9375rem' }}>Cumplimiento RGPD</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🇪🇺</div>
              <div style={{ fontWeight: '700', fontSize: '0.9375rem' }}>Datos protegidos en la UE</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: '800', marginBottom: '1rem' }}>
          Empieza a usar VerbaDoc Pro <span style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>gratis</span>
        </h2>
        <p style={{ color: mutedColor, fontSize: '1.125rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
          Regístrate y prueba la plataforma sin compromiso. Sin tarjeta de crédito.
        </p>
        <button
          onClick={onAccess}
          style={{
            padding: '1rem 3rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: 'white', border: 'none', borderRadius: '14px', fontSize: '1.125rem',
            fontWeight: '700', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Crear cuenta gratuita
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '2rem 1rem', borderTop: `1px solid ${borderColor}`, textAlign: 'center' }}>
        <p style={{ color: mutedColor, fontSize: '0.875rem' }}>
          © 2026 VerbaDoc Pro — Videoconversion Digital Lab, S.L. • Barcelona, España • Procesamiento 100% en Europa 🇪🇺
        </p>
        <p style={{ color: mutedColor, fontSize: '0.8125rem', marginTop: '0.5rem' }}>
          <a href="https://www.mediasolam.eu" target="_blank" rel="noopener noreferrer" style={{ color: accentBlue, textDecoration: 'none' }}>mediasolam.eu</a>
          {' • '}
          <a href="https://videoconversion.es" target="_blank" rel="noopener noreferrer" style={{ color: accentBlue, textDecoration: 'none' }}>videoconversion.es</a>
        </p>
      </footer>
    </div>
  );
}
