import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from '../src/lib/transform.interceptor';
import { HttpStatus } from '@nestjs/common';
import { BridgeService } from '../src/externals/bridge/bridge.service';
import { CreateUserDtoMother } from './CreateUserDtoMother';
import { PaymentsService } from '../src/externals/payments/payments.service';

// Running e2e tests require a database named "Xcloud_test" in the mariadb database first.
describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Cannot do E2E tests without NODE_ENV=test ');
    }
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HTTP tests', () => {
    // describe('TRASH Endpoints', () => {
    //   describe('Get Trash', () => {
    //     it('/storage/trash (GET) - Unauthorized', async () => {
    //       return request(app.getHttpServer()).get('/storage/trash').expect(401);
    //     });

    //     it('/storage/trash (GET) - Return 200', async () => {
    //       return request(app.getHttpServer())
    //         .get('/storage/trash')
    //         .set('Authorization', 'Bearer ' + token)
    //         .expect(200);
    //     });
    //   });

    //   describe('Move Items To Trash', () => {
    //     it('/storage/trash/add (POST) - Unauthorized', async () => {
    //       return request(app.getHttpServer())
    //         .post('/storage/trash/add')
    //         .expect(401);
    //     });

    //     it('/storage/trash/add (POST) - Return 200', async () => {
    //       return request(app.getHttpServer())
    //         .post('/storage/trash/add')
    //         .set('Authorization', 'Bearer ' + token)
    //         .send({
    //           items: [{ id: '4', type: 'folder' }],
    //         })
    //         .expect(200);
    //     });

    //     it('/storage/trash/add (POST) - Return 400 - types invalid', async () => {
    //       const response = await request(app.getHttpServer())
    //         .post('/storage/trash/add')
    //         .set('Authorization', 'Bearer ' + token)
    //         .send({
    //           items: [{ id: '4', type: 'folder2' }],
    //         });

    //       expect(response.status).toBe(400);
    //       expect(response.body).toEqual({
    //         error: 'Bad Request',
    //         message: 'type folder2 invalid',
    //         statusCode: 400,
    //       });
    //     });
    //   });
    // });

    describe('Send Links Endpoints', () => {
      let sendLink;
      describe('Create Send Link', () => {
        it('/links (POST) - Return 201 - Created', async () => {
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({
              items: [
                {
                  name: 'test',
                  type: 'file',
                  networkId: 'test',
                  encryptionKey: 'test',
                  size: 100000,
                },
              ],
              sender: 'clopez@internxt.com',
              receivers: ['clopez@internxt.com'],
              plainCode: 'code',
              code: 'code',
              title: 'File Test',
              subject: 'Esto es una prueba de archivo',
            });
          expect(response.status).toBe(HttpStatus.CREATED);
          sendLink = response.body;
        });
        it('/links (POST) - Return 400 - Fields invalids', async () => {
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({});
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(response.body.message).toMatchObject([
            'code should not be empty',
            'plainCode should not be empty',
            'items must contain not more than 100 elements',
            'items must be an array',
          ]);
        });
        it('/links (POST) - Return 400 - Max size of item', async () => {
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({
              items: [
                {
                  name: 'test',
                  type: 'file',
                  networkId: 'test',
                  encryptionKey: 'test',
                  size: 606870910000,
                },
              ],
              sender: 'clopez@internxt.com',
              receivers: ['clopez@internxt.com'],
              plainCode: 'code',
              code: 'code',
              title: 'File Test',
              subject: 'Esto es una prueba de archivo',
            });
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(response.body.message).toMatchObject([
            'items.0.size must not be greater than 5G',
          ]);
        });
        it('/links (POST) - Return 400 - Max 100 items', async () => {
          const items = [];
          for (let i = 0; i <= 101; i++) {
            items.push({
              name: 'test',
              type: 'file',
              networkId: 'test',
              encryptionKey: 'test',
              size: 100000,
            });
          }
          const response = await request(app.getHttpServer())
            .post('/links')
            .send({
              items,
              sender: 'clopez@internxt.com',
              receivers: ['clopez@internxt.com'],
              plainCode: 'code',
              code: 'code',
              title: 'File Test',
              subject: 'Esto es una prueba de archivo',
            });
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(response.body).toMatchObject({
            error: 'Bad Request',
            message: ['items must contain not more than 100 elements'],
            statusCode: HttpStatus.BAD_REQUEST,
          });
        });
      });

      describe('Get Send Link', () => {
        it('/links/:linkId (GET) - Return 404 - LinkId invalid', async () => {
          const response = await request(app.getHttpServer())
            .get(`/links/test`)
            .send();
          expect(response.body).toMatchObject({
            error: 'Bad Request',
            message: 'id is not in uuid format',
            statusCode: HttpStatus.BAD_REQUEST,
          });
        });
        it('/links/:linkId (GET) - Return 200 - Found', async () => {
          const response = await request(app.getHttpServer())
            .get(`/links/${sendLink.id}`)
            .send();
          expect(response.status).toBe(HttpStatus.OK);
          expect(response.body).toMatchObject({
            id: sendLink.id,
            subject: sendLink.subject,
            title: sendLink.title,
            code: sendLink.code,
          });
        });
      });
    });
  });

  describe('Auth', () => {
    describe('signup', () => {
      let signupApp: INestApplication;
      const bridgeUser = '536fb7a-5ef4-52d2-802a-95569a410dc';
      const uuid = Date.now().toString();

      beforeAll(async () => {
        if (process.env.NODE_ENV !== 'test') {
          throw new Error('Cannot do E2E tests without NODE_ENV=test ');
        }

        const bridgeService = {
          createUser: () =>
            Promise.resolve({
              userId: bridgeUser,
              uuid,
            }),
          createBucket: () => ({
            id: 3186365865,
          }),
          getLimit: () => Promise.resolve(2539622667),
        } as unknown as BridgeService;

        const paymentsService = {
          hasSubscriptions: () => Promise.resolve(false),
        };

        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        })
          .overrideProvider(BridgeService)
          .useValue(bridgeService)
          .overrideProvider(PaymentsService)
          .useValue(paymentsService)
          .compile();

        signupApp = moduleFixture.createNestApplication();
        signupApp.useGlobalPipes(new ValidationPipe());
        signupApp.useGlobalInterceptors(new TransformInterceptor());

        await signupApp.init();
      });

      afterAll(async () => {
        signupApp.close();
      });

      it('should be able to register a user', async () => {
        const email = `test${Date.now()}@internxt.com`;

        const response = await request(signupApp.getHttpServer())
          .post('/users')
          .send(CreateUserDtoMother.create(email));

        expect(response.status).toBe(HttpStatus.CREATED);
      });

      /*       it('should be able to register a referred user', async () => {
        const referralInserted = await insertReferral('invite-friends');

        server.services.Inxt.RegisterBridgeUser = sinon
          .stub(server.services.Inxt, 'RegisterBridgeUser')
          .onFirstCall()
          .returns({
            response: {
              status: HttpStatus.OK,
            },
            data: {
              uuid: '94b6b993-0a39-5ed0-8838-28fdae43c38a',
            },
          })
          .onSecondCall()
          .returns({
            response: {
              status: HttpStatus.OK,
            },
            data: {
              uuid: 'e0d49789-d80c-5ae8-8775-0f7041688b46',
            },
          });
        server.services.Mail.sendInviteFriendMail = sinon
          .stub(server.services.Mail, 'sendInviteFriendMail')
          .resolves();
        server.services.Inxt.addStorage = sinon
          .stub(server.services.Inxt, 'addStorage')
          .resolves();
        server.services.Plan.hasBeenIndividualSubscribedAnyTime = sinon
          .stub(server.services.Plan, 'hasBeenIndividualSubscribedAnyTime')
          .resolves(false);

        const inviter = await registerTestUser('inviter@internxt.com');

        const { status } = await request(app)
          .post('/api/register')
          .send({
            ...registrationBodyFor(TEST_USER_EMAIL),
            referrer: inviter.referralCode,
          });

        expect(status).toBe(HttpStatus.OK);

        server.services.Mail.sendInviteFriendMail.restore();
        server.services.Inxt.addStorage.restore();
        server.services.Plan.hasBeenIndividualSubscribedAnyTime.restore();

        if (referralInserted !== undefined) {
          await deleteReferral(referralInserted);
        }
      }); */

      /*       it('should rollback succecfully if fails after the user is insterted on the database', async () => {
        const RegisterBridgeUserMock = sinon.stub(
          server.services.Inxt,
          'RegisterBridgeUser',
        );
        RegisterBridgeUserMock.returns({
          response: {
            status: 500,
            data: {
              error: 'fake error',
            },
          },
        });

        server.services.Inxt.RegisterBridgeUser = RegisterBridgeUserMock;

        const response = await request(app)
          .post('/api/register')
          .send(registrationBodyFor(TEST_USER_EMAIL));

        const [, result] = await server.database.query(
          'SELECT * FROM users WHERE email = (:userEmail)',
          {
            replacements: { userEmail: TEST_USER_EMAIL },
          },
        );

        expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(result.rowCount).toBe(0);
      }); */
    });
  });
});
