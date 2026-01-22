import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logActivity } from '../utils/activityLogger';

// Departamentos disponibles en Europa
export type EuropaDepartment =
    | 'general'
    | 'contabilidad'
    | 'finanzas'
    | 'marketing'
    | 'legal'
    | 'recursoshumanos';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    department: EuropaDepartment;
    createdAt: Date;
    lastLogin: Date;
    role: 'user' | 'admin';
}

// Mock de FirebaseUser para mantener compatibilidad
interface MockFirebaseUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: 'user' | 'admin';
}

interface AuthContextType {
    currentUser: MockFirebaseUser | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signup: (email: string, password: string, displayName: string, department: EuropaDepartment) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    hasDepartmentAccess: (department: EuropaDepartment) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

// Funciones helper para localStorage
const STORAGE_KEYS = {
    USERS: 'mock_auth_users_europa',
    CURRENT_USER: 'mock_auth_current_user_europa'
};

interface StoredUser {
    uid: string;
    email: string;
    password: string; // En producción NUNCA almacenar contraseñas en plain text
    displayName: string;
    department: EuropaDepartment;
    createdAt: string;
    lastLogin: string;
    role: 'user' | 'admin';
}

function getAllUsers(): StoredUser[] {
    const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
    return usersJson ? JSON.parse(usersJson) : [];
}

function saveAllUsers(users: StoredUser[]) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getCurrentUserSession(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
}

function setCurrentUserSession(uid: string) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, uid);
}

function clearCurrentUserSession() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [currentUser, setCurrentUser] = useState<MockFirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Registro de nuevo usuario - Now uses secure backend API
    async function signup(email: string, password: string, displayName: string, department: EuropaDepartment) {
        try {
            // Call real backend API with bcrypt hashing
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    name: displayName
                }),
                credentials: 'include', // Important for httpOnly cookies
            });

            if (!response.ok) {
                const errorData = await response.json();
                // Map backend errors to frontend format
                if (errorData.error?.includes('ya existe') || errorData.error?.includes('already exists')) {
                    throw new Error('auth/email-already-in-use');
                }
                throw new Error(errorData.error || 'auth/registration-failed');
            }

            const data = await response.json();
            const apiUser = data.user;

            // Map backend user to frontend format
            const mockUser: MockFirebaseUser = {
                uid: apiUser.id,
                email: apiUser.email,
                displayName: apiUser.name || displayName,
                role: apiUser.role,
            };

            const profile: UserProfile = {
                uid: apiUser.id,
                email: apiUser.email,
                displayName: apiUser.name || displayName,
                department: department,
                createdAt: new Date(apiUser.created_at || Date.now()),
                lastLogin: new Date(),
                role: apiUser.role,
            };

            // Store minimal data in localStorage (department only, NO passwords)
            const users = getAllUsers();
            const newLocalUser: StoredUser = {
                uid: apiUser.id,
                email: apiUser.email,
                password: '', // Never store passwords
                displayName: profile.displayName,
                department: department,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                role: apiUser.role,
            };
            users.push(newLocalUser);
            saveAllUsers(users);

            setCurrentUserSession(apiUser.id);
            setCurrentUser(mockUser);
            setUserProfile(profile);

            // Log activity
            logActivity(
                apiUser.id,
                apiUser.email,
                profile.displayName,
                'REGISTRO',
                `Usuario registrado de forma segura en departamento: ${department}`,
                department
            );

            return;
        } catch (error: any) {
            throw error;
        }
    }

    // Login - Now uses backend API for security
    async function login(email: string, password: string) {
        try {
            // Call real backend API
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include', // Important for httpOnly cookies
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'auth/login-failed');
            }

            const data = await response.json();
            const apiUser = data.user;

            // Map backend user to frontend format
            const mockUser: MockFirebaseUser = {
                uid: apiUser.id,
                email: apiUser.email,
                displayName: apiUser.name || apiUser.email.split('@')[0],
                role: apiUser.role,
            };

            // Get department from localStorage or default to 'general'
            const users = getAllUsers();
            const localUser = users.find(u => u.email === email);
            const department: EuropaDepartment = localUser?.department || 'general';

            const profile: UserProfile = {
                uid: apiUser.id,
                email: apiUser.email,
                displayName: apiUser.name || apiUser.email.split('@')[0],
                department: department,
                createdAt: new Date(apiUser.created_at || Date.now()),
                lastLogin: new Date(),
                role: apiUser.role,
            };

            // Update localStorage for backwards compatibility
            if (!localUser) {
                const newLocalUser: StoredUser = {
                    uid: apiUser.id,
                    email: apiUser.email,
                    password: '', // No longer store passwords
                    displayName: profile.displayName,
                    department: department,
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    role: apiUser.role,
                };
                users.push(newLocalUser);
                saveAllUsers(users);
            } else {
                // Update lastLogin
                localUser.lastLogin = new Date().toISOString();
                localUser.password = ''; // Clear old insecure passwords
                saveAllUsers(users);
            }

            setCurrentUserSession(apiUser.id);
            setCurrentUser(mockUser);
            setUserProfile(profile);

            // Log activity
            logActivity(
                apiUser.id,
                apiUser.email,
                profile.displayName,
                'LOGIN',
                'Usuario inició sesión de forma segura',
                department
            );

            return;
        } catch (error: any) {
            // If backend fails, throw error (no fallback to insecure localStorage)
            throw error;
        }
    }

    // Logout - Now calls backend API to clear httpOnly cookie
    async function logout() {
        console.log("🔴 LOGOUT INICIADO - Función logout llamada");
        // Log activity before logout
        if (currentUser && userProfile) {
            logActivity(
                currentUser.uid,
                currentUser.email || '',
                currentUser.displayName || '',
                'LOGOUT',
                'Usuario cerró sesión',
                userProfile.department
            );
        }

        try {
            // Call logout API to clear httpOnly cookie
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Logout API call failed:', error);
            // Continue with local logout even if API fails
        }

        clearCurrentUserSession();
        console.log("🔴 LOGOUT COMPLETADO - Usuario limpiado");
        setCurrentUser(null);
        
        // Forzar recarga para mostrar modal de login
        window.location.reload();
        setUserProfile(null);
    }

    // Verificar acceso a departamento
    function hasDepartmentAccess(department: EuropaDepartment): boolean {
        if (!userProfile) return false;
        if (userProfile.role === 'admin') return true;
        // El usuario puede acceder a su propio departamento o a 'general'
        return userProfile.department === department || department === 'general';
    }

    // Cargar sesión al iniciar - Now verifies with backend API
    useEffect(() => {
        const loadSession = async () => {
            try {
                // Verify session with backend using httpOnly cookie
                const response = await fetch('/api/auth/verify', {
                    credentials: 'include',
                });

                if (response.ok) {
                    const data = await response.json();
                    const apiUser = data.user;

                    // Get department from localStorage
                    const users = getAllUsers();
                    const localUser = users.find(u => u.uid === apiUser.id || u.email === apiUser.email);
                    const department: EuropaDepartment = localUser?.department || 'general';

                    const mockUser: MockFirebaseUser = {
                        uid: apiUser.id,
                        email: apiUser.email,
                        displayName: apiUser.name || apiUser.email.split('@')[0],
                        role: apiUser.role,
                    };

                    const profile: UserProfile = {
                        uid: apiUser.id,
                        email: apiUser.email,
                        displayName: apiUser.name || apiUser.email.split('@')[0],
                        department: department,
                        createdAt: new Date(apiUser.created_at || Date.now()),
                        lastLogin: new Date(),
                        role: apiUser.role,
                    };

                    setCurrentUserSession(apiUser.id);
                    setCurrentUser(mockUser);
                    setUserProfile(profile);
                } else {
                    // No valid session, clear everything
                    clearCurrentUserSession();
                    setCurrentUser(null);
                    setUserProfile(null);
                }
            } catch (error) {
                console.error('Failed to verify session:', error);
                // Clear session on error
                clearCurrentUserSession();
                setCurrentUser(null);
                setUserProfile(null);
            } finally {
                setLoading(false);
            }
        };

        loadSession();
    }, []);

    const value: AuthContextType = {
        currentUser,
        userProfile,
        loading,
        signup,
        login,
        logout,
        hasDepartmentAccess
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
