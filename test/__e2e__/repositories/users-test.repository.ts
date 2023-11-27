import { QueryTypes, Sequelize } from 'sequelize';
import { users as testUsers } from '../../../seeders/20230308180046-test-users';
import { Sign } from '../../../src/middlewares/passport';

export class UserTestRepository {
  constructor(private readonly sequelize: Sequelize) {}

  public async getPrincipalUser(): Promise<any> {
    const user = testUsers.testUser;

    const users = await this.sequelize.query(
      `SELECT * FROM users WHERE email = :email`,
      {
        replacements: { email: user.email },
        type: QueryTypes.SELECT,
      },
    );

    return users[0];
  }

  public generateToken(user: any, jwtSecret: string): string {
    return Sign(
      {
        payload: {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          name: user.name,
          lastname: user.lastname,
          username: user.username,
          sharedWorkspace: true,
          networkCredentials: {
            user: user.bridge_user,
            pass: user.user_id,
          },
        },
      },
      jwtSecret,
      true,
    );
  }
}
