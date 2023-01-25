import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RS256JwtAuthGuard extends AuthGuard('rs256jwt') {}
