import type { Response } from "express";

/** Send a 404 response shaped like the OpenAPI `Problem` schema. */
export function notFound(res: Response, detail: string): void {
  res.status(404).json({
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail,
  });
}
