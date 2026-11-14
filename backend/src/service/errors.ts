// Errors the service throws on purpose. The transport (HTTP) decides what status they become.

export type ServiceErrorKind = 'bad_request' | 'not_found' | 'conflict';

export class ServiceError extends Error {
  constructor(
    readonly kind: ServiceErrorKind,
    readonly code: string, // stable, machine-readable, e.g. "game_over"
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const badRequest = (code: string, message: string) => new ServiceError('bad_request', code, message);
export const notFound = (code: string, message: string) => new ServiceError('not_found', code, message);
export const conflict = (code: string, message: string) => new ServiceError('conflict', code, message);
