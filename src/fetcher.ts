import { Env, CacheParams, MIMEPair } from './types';

export interface FetcherInterface {
    getCacheParams(): CacheParams;
    getRequest(): Promise<Request | null>;
    fetch():  Promise<Response>;
    getMIME(): MIMEPair;
}