import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AuthConfig {
  baseUrl: string;
  jwksUrl?: string;
}

export function createTokenVerifier(config: AuthConfig, keys?: JWTVerifyGetKey) {
  const baseUrl = new URL(config.baseUrl);
  if (baseUrl.protocol !== 'https:') throw new Error('Auth URL must use HTTPS');
  // Managed Better Auth uses the origin (not its /database/auth path) for both claims.
  const issuer = baseUrl.origin;
  const jwks = keys ?? createRemoteJWKSet(
    new URL(config.jwksUrl ?? `${config.baseUrl.replace(/\/$/, '')}/.well-known/jwks.json`),
    { timeoutDuration: 15000 },
  );
  return async (token: string): Promise<string | null> => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ['EdDSA'],
        issuer,
        audience: issuer,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      if (!payload.sub || payload.sub.length > 255 || payload.role !== 'authenticated' || payload.banned === true) return null;
      return payload.sub;
    } catch (error) {
      if (error instanceof errors.JWTClaimValidationFailed || error instanceof errors.JWTExpired
        || error instanceof errors.JOSEAlgNotAllowed || error instanceof errors.JOSENotSupported
        || error instanceof errors.JWSInvalid || error instanceof errors.JWTInvalid
        || error instanceof errors.JWSSignatureVerificationFailed || error instanceof errors.JWKSNoMatchingKey) return null;
      throw error;
    }
  };
}
