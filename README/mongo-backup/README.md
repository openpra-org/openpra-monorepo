# Backing up database

To backup your local mongo database follow the below steps
1. Make sure whatever you need to backup is there in the database
2. Open a new terminal
3. Use command `mongodump --uri=mongodb://localhost:27017 --out=./fixtures/dump`
4. Your current mongo db will be dumped at `fixtures/dump`

Note: The fixtures/dump folder is by default git ignored

# Restoring your database

To restore the database simply run the command `mongorestore fixtures/dump/`.
