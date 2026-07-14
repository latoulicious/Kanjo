// Shared error shape for both transports (HTTP fetch and the on-device SQLite
// store) so `instanceof ApiError` checks in the UI behave identically.
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}
