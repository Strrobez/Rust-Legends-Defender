import { CommandInteractionOptionResolver, PermissionResolvable } from "discord.js";
import { client } from "../..";
import { Event } from "../../structures/Event";
import { ICommandInteraction } from "../../typings/Command";

import { noTryAsync } from "no-try";

export default new Event("interactionCreate", async (interaction) =>
{
    if (interaction.isCommand())
    {
        // noTryAsync(async () => );

        await interaction.deferReply()

        let command = client.commands.get(interaction.commandName);

        if (!command) return;

        command.run({
            args: interaction.options as CommandInteractionOptionResolver,
            client,
            interaction: interaction as ICommandInteraction
        });
    }
});