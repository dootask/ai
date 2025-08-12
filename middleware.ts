// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const reqHeaders = new Headers(request.headers);
  const theme = request.nextUrl.searchParams.get('theme');
  reqHeaders.set('x-theme', theme || '');
  return NextResponse.next({
    request: {
      headers: reqHeaders,
    }
  });
}