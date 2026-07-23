import { defineRelations } from "drizzle-orm";

import { serverConfigTable, userProfileTable } from "./schema.js";

export const relations = defineRelations(
	{
		serverConfigTable,
		userProfileTable,
	},
	(r) => ({
		serverConfigTable: {
			members: r.many.userProfileTable({
				from: r.serverConfigTable.id,
				to: r.userProfileTable.serverId,
			}),
		},
		userProfileTable: {
			server: r.one.serverConfigTable({
				from: r.userProfileTable.serverId,
				to: r.serverConfigTable.id,
			}),
		},
	}),
);
