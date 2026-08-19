import {JwtUtil} from './jwt-util';
import HmacSHA256 from 'crypto-js/hmac-sha256';
import Utf8 from 'crypto-js/enc-utf8';
import Base64url from 'crypto-js/enc-base64url';

describe('JwtUtil', () => {
    const token = `eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJHUnh4OHVyNDNwWEgzX1FNekJXZXJRUFdyWDAyUEprSzlDemwzaGM2MGZBIn0.eyJqdGkiOiJiODExZjFiMi00NTZlLTRjZmMtYmQ3NS1jOTcxOWU4YmUwZTIiLCJleHAiOjE3MTEwMjM3MjcsIm5iZiI6MCwiaWF0IjoxNzA4NDMxNzI3LCJpc3MiOiJodHRwczovL3N0YWdpbmcuc3VuYmlyZGVkLm9yZy9hdXRoL3JlYWxtcy9zdW5iaXJkIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6ImY6OTc5NzM4YjctMjUzYy00YWRmLTk2NzMtYTg1N2VlYjg2MTE1OjM3MjUwNGM3LTgzOGEtNDMzYy1hMjRkLWY4YWMwZWQ1YzQ4MCIsInR5cCI6IkJlYXJlciIsImF6cCI6ImFuZHJvaWQiLCJhdXRoX3RpbWUiOjE3MDg0MzE3MjcsInNlc3Npb25fc3RhdGUiOiJlZmZjOTBhMy1kOGE0LTQ1YWQtYjYwYi04MWI0ZTE2MGQ1NGMiLCJhY3IiOiIxIiwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6Im9mZmxpbmVfYWNjZXNzIiwibmFtZSI6InRlc3QyMCIsInByZWZlcnJlZF91c2VybmFtZSI6InRlc3QyMF8zbm50IiwiZ2l2ZW5fbmFtZSI6InRlc3QyMCIsImVtYWlsIjoidGUqKioqQHlvcG1haWwuY29tIn0.Qppm-QhGKuOY5fHI1tDL7E3J8BeRhcBgIZt1iK-tf3RsVyjFjkiVJQfySpGOCX9tF3K0xVbmlkpk099ON2J0KtkiO_Zz4w9bke2KjUaSuB5SuKx2sWq6hupf0TS7koHWqR54IVhVS8rQs0D5lEdCKBknluN4uronOtpsG_5S1a-S054se3ke8Z8QY-GKwOeurnIpPQdERPKPi1f3EA2dI5OJeUnBarXdr0K9RiPpGue-S2S8-e1kEKOsMiv6hPVKRcNP6VQMjzShlRN5mzGypBtLVWLgUEhEnUwXX9xc7yBcgFe1i2lDTwxx3Mn2caTwaeNlhlC_SXYDNWJifJjBzw`
    const obj = `{
        "jti": "b811f1b2-456e-4cfc-bd75-c9719e8be0e2",
        "exp": 1711023727,
        "nbf": 0,
        "iat": 1708431727,
        "iss": "https://staging.sunbirded.org/auth/realms/sunbird",
        "aud": "account",
        "sub": "f:979738b7-253c-4adf-9673-a857eeb86115:372504c7-838a-433c-a24d-f8ac0ed5c480",
        "typ": "Bearer",
        "azp": "android",
        "auth_time": 1708431727,
        "session_state": "effc90a3-d8a4-45ad-b60b-81b4e160d54c",
        "acr": "1",
        "realm_access": {
            "roles": [
                "offline_access",
                "uma_authorization"
            ]
        },
        "resource_access": {
            "account": {
                "roles": [
                    "manage-account",
                    "manage-account-links",
                    "view-profile"
                ]
            }
        },
        "scope": "offline_access",
        "name": "test20",
        "preferred_username": "test20_3nnt",
        "given_name": "test20",
        "email": "te****@yopmail.com"
    }`

    describe('decodeJWT()', () => {
        it('should decode the payload segment of a real JWT', async () => {
            const decoded = await JwtUtil.decodeJWT(token);
            expect(JSON.parse(decoded)).toEqual(JSON.parse(obj));
        });

        it('should reject when the token is malformed', async () => {
            await expect(JwtUtil.decodeJWT('not-a-jwt')).rejects.toBeDefined();
        });
    });

    describe('createJWTToken()', () => {
        it('should create an HS256 token whose header/body/signature match the sb-cordova-plugin-utility spec', async () => {
            const jwt = await JwtUtil.createJWTToken('deviceId', 'userId');
            const [header, body, signature] = jwt.split('.');

            expect(JSON.parse(Base64url.parse(header).toString(Utf8))).toEqual({ alg: 'HS256' });
            expect(JSON.parse(Base64url.parse(body).toString(Utf8))).toEqual({ iss: 'deviceId' });
            expect(signature).toEqual(Base64url.stringify(HmacSHA256(`${header}.${body}`, 'userId')));
        });

        it('should vary the signature with the secret key', async () => {
            const jwtA = await JwtUtil.createJWTToken('deviceId', 'userA');
            const jwtB = await JwtUtil.createJWTToken('deviceId', 'userB');
            expect(jwtA).not.toEqual(jwtB);
        });
    });
});
