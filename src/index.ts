/**
 * @author Peng Hou <houpengg@outlook.com>
 * @date 2024-08-01
 * @license MIT
 * Copyright (c) 2024 Peng Hou <houpengg@outlook.com>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Env } from './types';
import Dispatcher from './dispatcher';

// Cache Storage instance for Cloudflare Workers
const cache = (caches as any).default;

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            if (!['GET', 'HEAD'].includes(request.method)) {
                return new Response(null, {
                    status: 405,
                    statusText: 'Method Not Allowed'
                });
            }
        
            const dispatcher = new Dispatcher(request, env);

            // Check if the response cached
            const cacheRequest = new Request(dispatcher.geCacheURL(), request);
            const lastResponse: Response = await cache.match(cacheRequest);
            if (lastResponse) {
                return lastResponse;
            }
            
            const fetcher = dispatcher.getFetcher();
            const handler = dispatcher.getHandler();
            

            // Check if the original fetch response cachecd
            const fetcherRequest = await fetcher.getRequest();
            if (fetcherRequest == null) {
                return new Response(null, {
                    status: 500,
                    statusText: 'Internal Server Error'
                });
            }
            let fetcherResponse: Response = await cache.match(fetcherRequest);
            if (!fetcherResponse) {
                fetcherResponse = await fetcher.fetch();
                // Cache the original fetch response
                await cache.put(fetcherRequest, fetcherResponse.clone());
            }

            // Set Content-Type
            const newHeaders = new Headers(fetcherResponse.headers);
            newHeaders.set('Content-Type', 'image/jpeg'); // handler.getMIME().mime
            newHeaders.set('Cache-Control', 'public, max-age=3600');

            if (fetcherResponse.status !== 200 || request.method === 'HEAD') {
                const response = new Response(null, {
                    status: fetcherResponse.status,
                    statusText: fetcherResponse.statusText,
                    headers: newHeaders,
                });
                await cache.put(cacheRequest, response.clone());
                return response;
            }
            
            const handlerResponse = await handler.handle(fetcherRequest as Request, fetcherResponse);

            let response = new Response(handlerResponse, {
                status: fetcherResponse.status,
                statusText: fetcherResponse.statusText,
                headers: newHeaders
            });
            await cache.put(cacheRequest, response.clone());
            return response;
        } catch (error) {
            console.log(`Error: ${error.message}`);
            console.log('Error stack:', error.stack);
            console.log('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};

