export declare class JwtUtil {
    static decodeJWT(accessToken: string): Promise<any>;
    static createJWTToken(deviceId: string, userId: string): Promise<string>;
}
