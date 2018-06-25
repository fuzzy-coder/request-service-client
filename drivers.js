const _ = require('lodash')

class RequestLoggingDriver{
    constructor(){
        this.driver = console
    }

    info(request, response){
        if(process.env.NODE_ENV !== 'production')
            this.driver.info(`SERVICE REQUEST COMPLETE :: ${_.upperCase(request.method)} ${request.uri} ${response.time}ms`)
    }

    error(request, response){
        this.driver.error(`SERVICE REQUEST ERROR :: ${_.upperCase(request.method)} ${request.uri} ${response.error}`)
    }
}

class HTTPClientDriver{
    constructor(){
        this.driver = require('request-promise-native')
    }

    get(config = {}){
        return this.driver.get(config)
    }

    post(config = {}){
        return this.driver.post(config)
    }

    patch(config= {}){
        return this.driver.patch(config)
    }

    put(config = {}){
        return this.driver.put(config)
    }

    delete(config = {}){
        return this.driver.delete(config)
    }
}

class CacheClientDriver{
    constructor(config = {}){
        this.driver = require('request-promise-native')
        this.expiry = config.expiry || 0
        this.cache_uri = config.uri
    }

    get(key){
        return this.driver.get({uri: this.cache_uri, json: true, qs: {key}, transform: response => {
            return {data: response.data, isCached: !!response.data}
        }});
    }

    set(key, value, expiry = this.expiry){
        if(expiry !== 0){
            return this.driver.post({uri: this.cache_uri, json: true, body: {key, payload: value,lifetime: expiry}, transform: response => {
                return {
                    isCached: true,
                    data: null
                }
            }})
        }
        else
            return Promise.resolve({isCached: false, data: null})
    }
}

module.exports = {RequestLoggingDriver, HTTPClientDriver, CacheClientDriver}