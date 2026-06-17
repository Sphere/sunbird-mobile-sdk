export declare abstract class SunbirdError extends Error {
    private readonly _code;
    protected constructor(message: string, code: string);
    get code(): string;
}
