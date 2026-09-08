// apps/api/src/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  // Los refresh tokens son opacos (no JWT); solo se guarda el hash,
  // nunca el valor crudo. El mecanismo general (15 min de access token,
  // refresh rotativo de 7 días en cookie httpOnly) está en `docs/Diseño
  // API.md` sección 2.1; el modelo vive en `prisma/schema.prisma`
  // (`RefreshToken.tokenHash`), no en `docs/Schema SQL.md`, que no incluye
  // las tablas de autenticación.
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string, displayName: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('El correo ya está registrado');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName },
    });

    // TODO: generar auth_tokens (type=email_verification) y disparar email
    // vía el servicio de notificaciones (ver `docs/Diseño del Módulo de
    // Recordatorios.md` sección 6 para el patrón de envío, aunque este
    // token no es un "reminder").

    return { id: user.id, email: user.email };
  }

  async login(
    email: string,
    password: string,
    userAgent?: string,
    ip?: string,
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Mismo mensaje de error exista o no el usuario/contraseña — evita
    // enumeración de cuentas. No está documentado en `docs/`: es una
    // decisión de esta implementación, consérvala al tocar este método.
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.issueTokenPair(user.id, user.role, userAgent, ip);
  }

  /**
   * Emite un par access+refresh nuevo, iniciando una nueva "family" de
   * rotación. Se usa en login y en el primer login OAuth.
   */
  private async issueTokenPair(
    userId: string,
    role: string,
    userAgent?: string,
    ip?: string,
    familyId?: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: userId, role },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawRefreshToken),
        familyId: familyId ?? crypto.randomUUID(),
        userAgent,
        ipAddress: ip,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /**
   * Rotación de refresh token con detección de reutilización — la pieza de
   * seguridad central de este módulo. `docs/Diseño API.md` sección 2.2 lista
   * el endpoint (`POST /auth/refresh`) y su sección 2.1 remite, para el
   * detalle del flujo, a un `diseno-autenticacion.md` que nunca se escribió:
   * hasta que exista, este método es la especificación de la regla.
   */
  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión expirada, inicia sesión de nuevo');
    }

    if (stored.revokedAt) {
      // ¡Un token ya rotado fue reenviado! Esto es la señal de que alguien
      // robó un refresh token y lo está usando después de que el legítimo
      // ya lo rotó. Se revoca TODA la cadena, no solo este token.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // TODO: notificar al usuario por email de actividad sospechosa
      // y disparar logout-all real en el frontend (invalidar cookie).

      throw new UnauthorizedException(
        'Se detectó actividad sospechosa; todas las sesiones fueron cerradas',
      );
    }

    // Rotación normal: revocar el actual, emitir uno nuevo en la misma family
    const newPair = await this.issueTokenPair(
      stored.userId,
      stored.user.role,
      stored.userAgent ?? undefined,
      stored.ipAddress ?? undefined,
      stored.familyId,
    );

    const newTokenHash = hashToken(newPair.refreshToken);
    const newRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: newRecord?.id },
    });

    return newPair;
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** "Cerrar sesión en todos los dispositivos" — revoca todas las families del usuario. */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
