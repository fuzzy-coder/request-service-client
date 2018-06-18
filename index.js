const DRIVERS = require('./drivers');
const _ = require('lodash');

class ServiceClient{
    constructor(config = {}){
        let moduleBuilder = new ModuleBuilder(config)
        _.assign(this, moduleBuilder.build())
    }

    async _callHTTP(method, options = {}){
        let response = null        
        let resolveWithFullResponse = true
        let json = true
        try{
            let startTime = new Date().getTime()
            response = await this.http.driver[method]({..._.omit(options, 'transformer'), resolveWithFullResponse, json})
            this.logger.driver.info({uri: options.uri, method}, {time: `${new Date().getTime() - startTime}`})
            return response
        }catch(error){
            this.logger.driver.error({uri: options.uri, method, error}, {error})
            throw error
        }
    }

    async call(method, options = {}){        
        let transformer = options.transformer || null

        if(!options.uri){
            throw new Error("IMPLEMENTATION ERROR :: please provide uri")
        }
        if(this.cache.config.isEnabled && !this.cache.config.expiry && !options.cache_expiry){
            throw new Error("IMPLEMENTATION ERROR :: either provide cache.expiry when initializing service client or pass cache_expiry method options")
        }

        if(this.cache.config.isEnabled){
            let key = options.uri
            let startTime = new Date().getTime()
            let {data, isCached} = await this.cache.driver.get(key)
            if(isCached){
                this.logger.driver.info({uri: `${options.uri} CACHED`, method}, {time: `${new Date().getTime() - startTime}`})
                return transformer ? transformer(data) : data
            }
            let response = await this._callHTTP(method, options)
            this.cache.driver.set(key, response.body, options.cache_expiry || null)
            return transformer ? transformer(response.body) : response.body
        }else{
            let response = await this._callHTTP(method, options)
            return transformer ? transformer(response.body) : response.body
        }
    }

    get(options = {}){
        return this.call('get', options)
    }

    post(options = {}){
        return this.call('post', options)
    }

    put(options = {}){
        return this.call('put', options)
    }

    patch(options = {}){
        return this.call('patch', options)
    }

    delete(options = {}){
        return this.call('delete', options)
    }
}

class ModuleBuilder{
    constructor(config={}){
        this.config = config
    }

    build(){
        let modules = { http: null, cache: null, logger: null };

        modules.cache = this.buildCacheDriver()

        modules.http = this.buildHttpDriver()

        modules.logger = this.buildLoggingDriver()
        
        return modules;
    }

    buildCacheDriver(){
        let module = { driver: null, config: {expiry: null, isEnabled: false} };
        if(this.config.cache){
            let cache = this.config.cache
            if(cache.methods){
                let methods = cache.methods
                
                if(!methods.set){
                    throw new Error('IMPLEMENTATION ERROR :: cache methods object should contain set method eg >> set(key, value, expiry)')
                }

                if(!methods.set){
                    throw new Error('IMPLEMENTATION ERROR :: cache methods object should contain set method eg >> get(key)')
                }

                let driver = new DRIVERS.CacheClientDriver()
                if(methods.set){
                    driver.set = methods.set.bind(driver)
                }

                if(methods.get){
                    driver.get = methods.get.bind(driver)
                }

                module.driver = driver
                module.config.isEnabled = true
            } else if (this.config.cache.uri){
                let driver = new DRIVERS.CacheClientDriver({uri: this.config.cache.uri, expiry: this.config.cache.expiry || null})
                module.driver = driver
                module.config.isEnabled = true
                module.config.expiry = this.config.cache.expiry || null
            } else if (!this.config.cache.uri){
                throw new Error('IMPLEMENTATION ERROR :: Either use methods to provide custom caching implementation or provide cache service uri')
            }
        }
        return module;
    }

    buildHttpDriver(){
        return {
            driver: new DRIVERS.HTTPClientDriver(),
            config: {}
        }
    }

    buildLoggingDriver(){
        let module = {driver: null, config: {}}

        if(this.config.logger && this.config.logger.methods){
            let logger = this.config.logger
            let methods = logger.methods

            if(!methods.info){
                throw new Error('IMPLEMENTATION ERROR :: logger methods object should contain info method eg >> info(request, response)')
            }

            if(!methods.error){
                throw new Error('IMPLEMENTATION ERROR :: logger methods object should contain error method eg >> error(request, response)')
            }

            let driver = new DRIVERS.RequestLoggingDriver()
            if(methods.info){
                driver.info = methods.info.bind(driver)
            }
            if(methods.error){
                driver.error = methods.error.bind(driver)
            }
            module.driver = driver
        }else{
            module.driver = new DRIVERS.RequestLoggingDriver()
        }
        
        return module
    }
}

module.exports = ServiceClient