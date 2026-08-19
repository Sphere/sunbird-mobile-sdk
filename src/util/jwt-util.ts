import HmacSHA256 from 'crypto-js/hmac-sha256';
import Utf8 from 'crypto-js/enc-utf8';
import Base64url from 'crypto-js/enc-base64url';

/**
 * Reimplements sb-cordova-plugin-utility's JWTTokenCreator (native Java) in pure TS:
 * header = base64url({"alg":"HS256"}), body = base64url({"iss": subject}),
 * signature = base64url(HMAC-SHA256(header + "." + body, secretKey)). No native call,
 * no device keystore involved — safe to run unconditionally on every platform.
 */
export class JwtUtil {
    public static decodeJWT(accessToken: string): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                const payloadSegment = accessToken.split('.')[1];
                resolve(Base64url.parse(payloadSegment).toString(Utf8));
            } catch (e) {
                reject(e);
            }
        });
    }

    public static createJWTToken(subject: string, secretKey: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                const header = Base64url.stringify(Utf8.parse(JSON.stringify({ alg: 'HS256' })));
                const body = Base64url.stringify(Utf8.parse(JSON.stringify({ iss: subject })));
                const signingInput = `${header}.${body}`;
                const signature = Base64url.stringify(HmacSHA256(signingInput, secretKey));
                resolve(`${signingInput}.${signature}`);
            } catch (e) {
                reject(e);
            }
        });
    }
}
