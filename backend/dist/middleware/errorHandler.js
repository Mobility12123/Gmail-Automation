"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, _next) => {
    logger_1.logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({
        error: {
            message,
            code: err.code || 'INTERNAL_ERROR',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
    });
};
exports.errorHandler = errorHandler;
class BadRequestError extends Error {
    statusCode = 400;
    code = 'BAD_REQUEST';
    constructor(message) {
        super(message);
        this.name = 'BadRequestError';
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends Error {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends Error {
    statusCode = 403;
    code = 'FORBIDDEN';
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends Error {
    statusCode = 404;
    code = 'NOT_FOUND';
    constructor(message = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends Error {
    statusCode = 409;
    code = 'CONFLICT';
    constructor(message) {
        super(message);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
//# sourceMappingURL=errorHandler.js.map