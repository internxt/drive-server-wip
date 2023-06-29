import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  Request as RequestDecorator,
  Response as ResponseDecorator,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Get('new-token')
  @UseGuards(AuthGuard('allow-old-jwt'))
  @ApiBearerAuth()
  async getNewToken(@RequestDecorator() req, @ResponseDecorator() res) {
    const newToken = this.authService.getNewToken(req.user);
    return res.status(200).json({ newToken });
  }
}
