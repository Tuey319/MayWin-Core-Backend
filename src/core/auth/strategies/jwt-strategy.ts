// src/core/auth/strategies/jwt-strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../types/jwt-payload';
import { TokenBlocklistService } from '../token-blocklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly blocklist: TokenBlocklistService,
  ) {
    const secret = config.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  // ISO 27001:2022 A.9.4.2 — reject tokens revoked at logout
  async validate(payload: JwtPayload) {
    if (payload.iat !== undefined && await this.blocklist.isBlocked(payload.sub, payload.iat)) {
      throw new UnauthorizedException('Session has been revoked');
    }
    return payload; // attaches to req.user
  }
}
