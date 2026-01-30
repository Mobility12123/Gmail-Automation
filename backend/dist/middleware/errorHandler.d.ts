import { Request, Response, NextFunction } from 'express';
export interface ApiError extends Error {
    statusCode?: number;
    code?: string;
}
export declare const errorHandler: (err: ApiError, req: Request, res: Response, _next: NextFunction) => void;
export declare class BadRequestError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string);
}
export declare class UnauthorizedError extends Error {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class ForbiddenError extends Error {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class NotFoundError extends Error {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class ConflictError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string);
}
//# sourceMappingURL=errorHandler.d.ts.map