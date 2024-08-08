// Todo

import { FetcherInterface } from './fetcher.ts';
import { Env, CacheParams, MIMEPair } from './types.ts';


export default class URLFetcher implements FetcherInterface {

    private request: Request;
    
    public constructor(request: Request, env: Env) {
        this.request = request;
    }

    public getCacheParams(): CacheParams {
        return {};
    }

    public async getRequest(): Promise<Request> {
        return this.request;
    }

    public async fetch(): Promise<Response> {
        return new Response();
    }

    public getMIME(): MIMEPair {
        return {ext: 'png', 'mime': 'image/png'}
    }

}