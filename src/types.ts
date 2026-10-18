import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

export type CommandCategory = "general" | "utility" | "moderation" | "admin";

export interface Command {
  data: {
    readonly name: string;
    readonly description: string;
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  category: CommandCategory;
  /** Only bot admins (stored admin roles, Manage Server or Administrator) may run it. */
  adminOnly?: boolean;
  /** May be used outside the configured command channel. */
  anyChannel?: boolean;
  execute(interaction: ChatInputCommandInteraction<"cached">): Promise<void>;
}
