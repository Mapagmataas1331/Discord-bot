import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

export type CommandCategory = "general" | "music" | "utility" | "moderation" | "admin";

export interface Command {
  data: {
    readonly name: string;
    readonly description: string;
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  category: CommandCategory;
  /** Only bot admins (stored admin roles, Manage Server or Administrator) may run it. */
  adminOnly?: boolean;
  /** Discord permissions the member must have (also used as default_member_permissions). */
  requiredPermissions?: bigint;
  /** May be used outside the configured command channel. */
  anyChannel?: boolean;
  execute(interaction: ChatInputCommandInteraction<"cached">): Promise<void>;
  /** Optional autocomplete handler for string options. */
  autocomplete?(interaction: AutocompleteInteraction<"cached">): Promise<void>;
}
