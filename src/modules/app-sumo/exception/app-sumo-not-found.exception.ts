import { AppSumoException } from './app-sumo.exception';

export class AppSumoNotFoundException extends AppSumoException {
  constructor(message?: string) {
    super(message ?? 'AppSumo not found');
  }
}
