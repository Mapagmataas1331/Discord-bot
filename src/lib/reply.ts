import { MessageFlags, type RepliableInteraction } from "discord.js";

/** Send an ephemeral message, whether or not the interaction was already acknowledged. */
export async function replyEphemeral(
  interaction: RepliableInteraction,
  content: string,
): Promise<void> {
  if (interaction.deferred) {
    await interaction.editReply({ content });
  } else if (interaction.replied) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
