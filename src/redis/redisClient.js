const redis = require('./index')

class RedisClient {

  static async getValue(key) {
    try {
      const value = await redis.get(key);
      return value;
    } catch (error) {
      console.log(`Error while getting redis value for key=${key}`, JS)
      throw error;
    }
  }

  static async setKey(key, value) {
    await redis.set(key, value);
    return true;
  }
  static async getValues(keys) {
    let obj = [];

    for (let index = 0; index < keys.length; index++) {
      const data = await this.getValue(keys[index]);
      obj.push({
        key: keys[index],
        value: data
      });
    }
    return obj;
  }
  static generateRandomWord(length = 10) {
    const alphabetList = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomWord = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * alphabetList.length);
      randomWord += alphabetList[randomIndex];
    }

    return randomWord;
  }
  static async getAll() {
    try {
      const keys = await redis.keys('*');
      const values = await this.getValues(keys);
      return values;
    } catch (error) {
      console.log("Error while fetching redis keys", error);
      return [];
    }

  }
}

module.exports = RedisClient;