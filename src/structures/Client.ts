import Config from "../../config";
const config: Config = require("../../config.json");

import { 
    ApplicationCommand,
    ApplicationCommandData,
    ApplicationCommandDataResolvable, 
    Client, 
    ClientEvents, 
    Collection, 
    User,
    Guild, 
    NonThreadGuildBasedChannel, 
    MessageEmbed, 
    TextChannel,
    Snowflake,
    MessageAttachment,
    GuildMember,
    Role,
    MessagePayload,
    MessageOptions
} from "discord.js";

import { Event } from "../structures/Event";
import { ICommandType } from "../typings/Command";
import { ICommandOptions } from "../typings/Client";

import Mute, { IMute } from "../models/mute.model";

import glob from "glob-promise";
import { client } from "..";

export class RLClient extends Client
{
    public config: Config = config;
    public commands: Collection<string, ICommandType> = new Collection();

    constructor()
    {
        super({ intents: 32767, partials: ["MESSAGE", "CHANNEL", "REACTION"] });
    }

    channel_log = async (guildId: Snowflake, content: string, embed?: MessageEmbed, file?: MessageAttachment) =>
    {  
        let guild: Guild = await this.guilds.fetch(guildId);

        if (!guild) return;

        let channel_id: Snowflake = config.discord.guilds[guild.id]?.channels["Discord Logs"];

        if (!channel_id) return;

        let text_channel: NonThreadGuildBasedChannel | TextChannel = await guild.channels.fetch(channel_id);
            text_channel = text_channel as TextChannel;

        let date        = new Date().toUTCString();
        let timestamp   = date.match(/\d{2}:\d{2}:\d{2}/); // POGU!

        let message_payload: MessagePayload | MessageOptions = {
            content: `\`[${timestamp}]\` ${content}`,
        };

        if (embed) 
        {
            message_payload = { 
                ...message_payload,
                embeds: [embed],
            };
        }

        if (file)
        {
            message_payload = {
                ...message_payload,
                files: [file],
            };
        }

        await text_channel.send(message_payload);
    }

    mention_str = (user: User) => `${user} **${user.username}**#${user.discriminator} (${user.id})`;
    
    muted_role = (guildId: Snowflake) =>
    {
        let guild: Guild = this.guilds.resolve(guildId);

        if (!guild) return;

        let role: string = config.discord.guilds[guildId]?.roles["Muted"];

        if (!role) return;

        return guild.roles.resolve(role);
    }
    lfg_muted_role = (guildId: Snowflake) =>
    {
        let guild: Guild = this.guilds.resolve(guildId);

        if (!guild) return;

        let role: string = config.discord.guilds[guildId]?.roles["LFG Muted"];

        if (!role) return;

        return guild.roles.resolve(role);
    }

    start = () =>
    {
        this.register_modules();

        this.login(config.discord.token);
    }

    import_file = async (path: string) =>
    {
        return (await import(path))?.default;
    }

    register_commands = async ({ guildId, commands }: ICommandOptions) =>
    {
        if (!guildId) return;

        let guild: Guild = (await this.guilds.fetch(guildId));

        if (guild)
        {
            await guild.commands.set(commands);
        }
    }

    check_mutes = async () =>
    {
        let mutes: (IMute & { _id: any; })[] = await Mute.find({
            $and: [
                { "expires": { $ne: 0 } },
                { "expires": { $lte: Date.now() } }
            ]
        });

        for (let i = 0; i < mutes.length; i++)
        {
            let mute: IMute = mutes[i];
            let guild: Guild = this.guilds.resolve(mute.guild_id);

            if (!guild) continue;

            let member: GuildMember = guild.members.resolve(mute.discord_id);

            if (!member) continue;

            let role_id: Snowflake = config.discord.guilds[mute.guild_id]?.roles[mute.type === "MUTE" ? "Muted" : "LFG Muted"];

            if (!role_id) continue;

            let role: Role = guild.roles.resolve(role_id);

            if (!role) continue;

            await member.roles.remove(role);
            await mute.remove();

            await this.channel_log(
                guild.id,
                `🔊 ${this.mention_str(this.user)} unmuted ${this.mention_str(member.user)}\n\`[ Reason ]\` Temporary Mute Completed`
            );
        }
        
        setInterval(this.check_mutes, 5 * 60 * 1000);
    }
    

    register_modules = async () =>
    {
        const slash_commands: ApplicationCommandDataResolvable[] = [];

        const command_files: string[] = await glob(`${__dirname}/../commands/*/*{.ts,.js}`);
    
        command_files.forEach(async (filePath: string) =>
        {
            const command: ICommandType = await this.import_file(filePath);

            if (!command.name) return;

            this.commands.set(command.name, command);

            slash_commands.push(command);
        });
        
        this.on("ready", async () =>
        {
            for (const guildId in config.discord.guilds)
            {   
                this.register_commands({ guildId, commands: slash_commands });
            }

            this.check_mutes();
        });

        const event_files: string[] = await glob(`${__dirname}/../events/*/*{.ts,.js}`);

        event_files.forEach(async (filePath: string) =>
        {
            const event: Event<keyof ClientEvents> = await this.import_file(filePath);

            this.on(event.name, event.run);
        });
    };
}