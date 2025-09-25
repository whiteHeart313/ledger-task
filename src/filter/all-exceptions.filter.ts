// all-exceptions.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Extract request details for logging
    const requestDetails = {
      url: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      body: this.sanitizeRequestBody(request.body),
      query: request.query,
    };

    // Log different types of errors with appropriate levels and details
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      // Client errors (4xx) are warnings, server errors (5xx) are errors
      if (status >= 500) {
        logger.error(`[${status}] Server error for ${request.method} ${request.url}:`, {
          exception: exceptionResponse,
          ...requestDetails,
          stack: exception.stack,
        });
      } else if (status >= 400) {
        logger.warn(`[${status}] Client error for ${request.method} ${request.url}:`, {
          exception: exceptionResponse,
          ...requestDetails,
        });
      }
    } else if (exception instanceof Error) {
      logger.error(`Unhandled exception for ${request.method} ${request.url}:`, {
        message: exception.message,
        name: exception.name,
        stack: exception.stack,
        ...requestDetails,
      });
    } else {
      logger.error(`Unknown error type for ${request.method} ${request.url}:`, {
        exception,
        ...requestDetails,
      });
    }
    
    // Handle specific error types
    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json(exception.getResponse());
    }
    
    // JWT errors
    if (exception instanceof Error) {
      if (exception.name === 'JsonWebTokenError') {
        return response.status(401).json({ message: 'Invalid token' });
      }
      
      if (exception.name === 'TokenExpiredError') {
        return response.status(401).json({ message: 'Token expired' });
      }
      
      // Validation errors
      if (exception.name === 'ValidationError') {
        return response.status(400).json({ message: exception.message });
      }
    }
    
    // Default error response
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).json({
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : exception instanceof Error ? exception.message : 'Unknown error',
      requestId: this.generateRequestId(), // Add a unique request ID for tracking in logs
    });
  }

  // Helper method to generate a unique request ID for tracking errors
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper method to sanitize sensitive data from request body for logging
  private sanitizeRequestBody(body: any): any {
    if (!body) return {};
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'apiKey'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}