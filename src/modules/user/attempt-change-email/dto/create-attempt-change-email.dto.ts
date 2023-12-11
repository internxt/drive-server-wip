import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateAttemptChangeEmail {
  @IsEmail()
  @IsNotEmpty()
  public readonly newEmail: string;
}
