# LBS Skol bot

This discord bot was made to handle our School discord server. It has features such as welcoming new members, assigning roles, moderating the server, and verifying new members. It is built using the discord.js library and is hopefully readable enough for anyone to understand.

### Features
- Welcoming new members with a custom message
- Verifying new members actually goes to our school
- Assigning roles to new members based on their status (student, teacher, etc)
- Moderating with a custom "softban" that kicks a user instead of banning to avoid IP bans
- A Honeypot channel to detect hacked accounts
- Temporary voice channels where the creator of the channel has control over who can join.
- Happy birthday messages for members on their birthday

### Setup - You will need a database to store information for the bot to work properly. 
1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env` file in the root directory and add your bot token, an example is provided in `.env.example`
   A large part of the bot uses a database to store information, so you will need a PostgreSQL server and its connection string in `DATABASE_URL`.
4. Push the schema with `bunx drizzle-kit push` (or `migrate` if you keep migrations)
5. Build the bot with `npm run build`
6. Run the bot with `npm start`

Or run the bot with `docker compose up -d`. It expects an existing PostgreSQL server reachable at `DATABASE_URL` — if that's another container, put them on the same docker network and use its container name as the host.

Demo Server: https://discord.gg/C4Y3DUVazK
Demo Video: https://youtu.be/kWozEePTmgU