import type { ChatInputCommandInteraction, Client, Guild } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";

import { GetAllWithBirthday, GetProfile, UpdateProfile } from "../../utils/profileManager.js";
import { numToMonth } from "../../utils/stringConvert.js";

const sortedList = async () => {
	const users = await GetAllWithBirthday();

    if (users.length === 0) return null;

    const formattedList = users
        .map((user) => {
            const birthday = user.birthday as UserProfile["birthday"] | null;
            return { user, birthday };
        })
        .sort((a, b) => {
            if (!a.birthday || !b.birthday) return 0;
            if (a.birthday.month !== b.birthday.month) {
                return a.birthday.month - b.birthday.month;
            }
            return a.birthday.day - b.birthday.day;
        });
	return formattedList
}

export const generateBirthdayPage = async (page: number, guild: Guild | null): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } | null> => {
    const formattedList = await sortedList();

	if (!formattedList || formattedList.length === 0) return null;

	const pageSize = 12;
    const maxPage = Math.ceil(formattedList.length / pageSize) || 1;
    
    const currentPage = Math.max(1, Math.min(page, maxPage));

	const pageItems = formattedList.slice((currentPage - 1) * pageSize, currentPage * pageSize);
	const descLines: string[] = [];
	const today = new Date();

	// Bad way to get the next birthday, it works ig
	const nextBirthday = formattedList.map(({ user, birthday }) => {
		if (!birthday) return null;
		return birthday.month > today.getMonth() + 1 ||
			(birthday.month === today.getMonth() + 1 && birthday.day > today.getDate())
			? { user, birthday }
			: { user, birthday: { ...birthday, month: birthday.month + 12 } };
	}).filter((entry) => entry !== null)[0];
	console.log(nextBirthday)
	
	for (let i = 0; i < pageItems.length; i++) {
		const { user, birthday } = pageItems[i];
		if (!birthday) {
			continue;
		}
		const age = today.getFullYear() - birthday.year;

		if (
			i > 0 && 
			pageItems[i - 1].birthday?.month == birthday.month && 
			pageItems[i - 1].birthday?.day == birthday.day
		){
			descLines.push(`↳ ・ <@${user.id}>, ${age} years old`);
		}else{
			// December now knows about January's existence
			const nextMonthNormalized = nextBirthday?.birthday ? (((nextBirthday.birthday.month - 1) % 12) + 1) : null;
			const isNextUp = !!nextBirthday?.birthday && nextMonthNormalized === birthday.month && nextBirthday.birthday.day === birthday.day;
			descLines.push(`__**${numToMonth(birthday.month)} ${birthday.day}**__${isNextUp ? " **(Next up)**" : ""}\n↳ ・ <@${user.id}>, ${age} years old`);
		}
		
		const next = pageItems[i + 1];

		if (next && next.birthday) {
			if (next.birthday.month !== birthday.month) {
				descLines.push("");
			}
		}
	}
	const description = descLines.join("\n");

	const embed = new EmbedBuilder()
		.setTitle(`Birthdays | Page ${currentPage}/${maxPage} [${formattedList.length}]`)
		.setThumbnail(guild?.iconURL() || null)
		.setColor("Aqua")
		.setFooter({ text: `Total (${formattedList.length}) ・ ${pageSize} per page [Showing: ${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, formattedList.length)}] ・ Use /birthday set to set your birthday!` })
		.setDescription(description);

	const first = new ButtonBuilder()
        .setEmoji('⏮️')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`birthdaychangepage:0a`)
        .setDisabled(currentPage <= 1);

    const prev = new ButtonBuilder()
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(`birthdaychangepage:${currentPage - 1}`)
        .setDisabled(currentPage <= 1);

    const next = new ButtonBuilder()
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(`birthdaychangepage:${currentPage + 1}`)
        .setDisabled(currentPage >= maxPage);

	const last = new ButtonBuilder()
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`birthdaychangepage:${maxPage}a`)
        .setDisabled(currentPage >= maxPage);


    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(first, prev, next, last);

    return {
        embeds: [embed],
        components: [row]
    };
};


const set = async (
	interaction: ChatInputCommandInteraction,
	_client: Client,
) => {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const date = interaction.options.getString("date", true);

	const [year, month, day] = date
		.match(/^(\d{4})-?(\d{2})-?(\d{2})$/)
		?.slice(1)
		.map(Number) || [null, null, null];

	if (!year || !month || !day) {
		await interaction.editReply({
			content: "Invalid date format. Please use YYYY-MM-DD.",
		});
		return;
	}
	if (
		interaction.options.getUser("user")?.id &&
		!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
	) {
		await interaction.editReply({
			content: "You don't have permission to set birthdays for other users.",
		});
		return;
	}

	const userId = interaction.options.getUser("user")?.id || interaction.user.id;
	if (!userId) {
		await interaction.editReply({ content: "User not found." });
		return;
	}
	await UpdateProfile(userId, { birthday: { year, month, day } });
	await interaction.editReply({
		content: `Birthday has been set to ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
	});
};

const get = async (
	interaction: ChatInputCommandInteraction,
	_client: Client,
) => {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const profile = await GetProfile(interaction.user.id);
	const birthday = profile?.birthday as UserProfile["birthday"] | null;
	if (!birthday) return await interaction.editReply({ content: "You haven't set your birthday yet." });

	await interaction.editReply({
		content: `Your birthday is set to ${birthday.year}-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`
	});
};



const list = async (
    interaction: ChatInputCommandInteraction,
    _client: Client,
    page: number = 1,
) => {
	await interaction.deferReply({});
    const pageData = await generateBirthdayPage(page, interaction.guild);

    if (!pageData) {
        // Handle empty list gracefully
        return interaction.editReply({ content: "No birthdays have been set yet!" });
    }

    await interaction.editReply(pageData);
};

const next = async (
	interaction: ChatInputCommandInteraction,
	_client: Client,
) => {
	await interaction.deferReply({});
	const formattedList = await sortedList();

	if (!formattedList || formattedList.length === 0) {
		await interaction.editReply({ content: "No birthdays have been set yet!" });
		return;
	}
	const today = new Date();
	const upcoming = formattedList
		.map(({ user, birthday }) => {
			if (!birthday) return null;

			return birthday.month > today.getMonth() + 1 ||
				(birthday.month === today.getMonth() + 1 && birthday.day > today.getDate())
				? { user, birthday }
				: { user, birthday: { ...birthday, month: birthday.month + 12 } };
		})
		.filter((entry) => entry !== null)

	if (upcoming.length === 0) {
		await interaction.editReply({ content: "No upcoming birthdays found until next year!" });
		return;
	}

	const nextBirthday = upcoming[0];

	const embed = new EmbedBuilder()
		.setTitle(`Next Birthday: ${numToMonth(nextBirthday.birthday?.month || 0)} ${nextBirthday.birthday?.day}`)
		.setThumbnail(interaction.guild?.members.cache.get(nextBirthday?.user.id)?.displayAvatarURL() || null)
		.setColor("Aqua")
		.setFooter({ text: `Use /birthday set to set your birthday!` })
		.setDescription(
			`The next birthday is <@${nextBirthday?.user.id}>'s who turns ${new Date().getFullYear() - nextBirthday.birthday.year} years old <t:${Math.floor(new Date(today.getFullYear(), (nextBirthday.birthday?.month || 1) - 1, nextBirthday.birthday?.day || 1).getTime() / 1000)}:R>`
		);
	
	await interaction.editReply({
		embeds: [embed],
		allowedMentions: { users: [] },
	});
};

const subcommands = {
	set,
	get,
	list,
	next,
} as const;

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("birthday")
		.setDescription("Manage your birthday")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("set")
				.setDescription("Sets your birthday")
				.addStringOption((option) =>
					option
						.setName("date")
						.setDescription("Your birthday (YYYY-MM-DD)")
						.setRequired(true),
				)
				.addUserOption((option) =>
					option
						.setName("user")
						.setDescription("Mod option to set birthday for another user")
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("get")
				.setDescription("Gets your birthday")
		)

		.addSubcommand((subcommand) =>
			subcommand.setName("list").setDescription("Lists all birthdays"),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("next").setDescription("Shows the next birthday"),
		),


	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		const subcommand = interaction.options.getSubcommand();
		const handler = subcommands[subcommand as keyof typeof subcommands];

		if (!handler) {
			// This should never run
			await interaction.editReply(`Unknown subcommand: ${subcommand}`);
			return;
		}

		await handler(interaction, client);
	},
};

export default command;
