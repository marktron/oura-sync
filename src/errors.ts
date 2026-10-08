export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export class AuthRequiredError extends Error {
  constructor(message = 'Authentication failed. Run `oura-sync login`.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Oura API returned ${status}: ${body}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class NoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoDataError';
  }
}
