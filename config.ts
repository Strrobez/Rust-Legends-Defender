export default interface Config {
    discord: {
        token: string;
        prefix: string;

        guilds: {
            [guildId: string]: {
                channels: {
                    [channelName: string]: string;
                },
                
                roles: {
                    [roleName: string]: string;
                }
            }
        },

        anti_raid: {
            enabled: boolean;
            joins: {
                enabled: boolean;
                trigger: number;
                punishment: string;
                time: number;
            },

            new_accounts: {
                enabled: boolean;
                trigger: number;
                punishment: string;
                time: number;
                account_age: number;
            }
        }
    },

    mongoose: {
        address: string;
        database: string;
    }
}