import {ConnectionConfig, MinervaConfig} from "./@types/MinervaConfig";
import {Knex, knex} from "knex";
import {asyncForEach, camelToSnakeCase, objKeysToCamelCase} from "./utility";

export class Minerva<ConnectionNames=any> {
    public connections :Map<ConnectionNames, Knex> = new Map();

    constructor(private config :MinervaConfig<ConnectionNames>) {
        this.connect();
    }

    private connect() :this {
        this.log("info", "Setting up connection pools");
        this.config.connections.forEach(this.createConnection.bind(this));
        return this;
    }

    private createConnection(connectionConfig :ConnectionConfig<ConnectionNames>) :this {
        this.log("info", `Setting up pool for ${connectionConfig.host}:${connectionConfig.port || 3306}...`);

        let config :any = {
            client: connectionConfig.client,
            postProcessResponse: async (result) => {
                if(this.config.camelizeKeys && result) {
                    if (Array.isArray(result)) {
                        return asyncForEach(result, row => objKeysToCamelCase(row));
                    }
                    return objKeysToCamelCase(result);
                }
            },
            wrapIdentifier: (value, origImpl, queryContext)=>{
                if(this.config.camelizeKeys) {
                    return origImpl(camelToSnakeCase(value));
                }
                return value;
            },
            connection: {
                host: connectionConfig.host,
                port: connectionConfig.port || 3306,
                user: connectionConfig.user,
                password: connectionConfig.password,
                database: connectionConfig.database,
            },
            pool: connectionConfig.pool || {
                min: 0,
                max: 15
            },
            log: {
                ...this.config.logger as any
            },
        };

        if(this.config.knexConfig) {
            config = {
                ...config,
                ...this.config.knexConfig
            };
        }

        if(connectionConfig.connectionOptions) {
            config.connection = {
                ...config.connection,
                ...connectionConfig.connectionOptions
            };
        }

        this.connections.set(connectionConfig.name as any, knex(config));
        return this;
    }

    private log(logger : "debug" | "info" | "warn" | "error", msg :any) {
        if(!this.config.disableLogs) {
            if(this.config.logger[logger]) {
                this.config.logger[logger](msg);
            }
            else{
                console.log(msg);
            }
        }
    }
}
