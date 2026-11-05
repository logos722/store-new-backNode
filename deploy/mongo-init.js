// Only executed for a NEW database directory. Changing env does not rotate existing users.
const database = db.getSiblingDB('gelion');
database.createUser({
  user: process.env.MONGO_APP_USER,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{role:'readWrite', db:'gelion'}],
});
