import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as mongoose from "mongoose";
import * as request from 'supertest';
import { ApiModule } from '../src/api.module'

describe('OpenPRA web-backend endpoints testing (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [ApiModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.enableShutdownHooks();
        app.useGlobalPipes(new ValidationPipe());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    //request = request('http://localhost:8000/api');

    let jwttoken: string;

    describe('user login', () => {
        it('token-obtain', async () => {
            const res = await request('http://localhost:8000/api')
                .post('/auth/token-obtain/')
                .send({
                    "username":"test2",
                    "password":"123456"
                });
            jwttoken = res.body.token;
            expect(res.status).tobe(200);
        });

        it('Get Model List', async () => {
            const res = await request('http://localhost:8000/api')
                .get('/collab/model/?type=hcl')
                .set('Authorization', 'JWT ' + jwttoken);
            expect(res.status).toBe(200);
            expect(res.body.count).toBe(0);
            expect(res.body.next).toBe(null);
            expect(res.body.previous).toBe(null);
            expect(res.body.results).toBe([]);
        });
    });
});