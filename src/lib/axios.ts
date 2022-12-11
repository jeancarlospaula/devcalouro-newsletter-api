import axios from 'axios';

const revueApi = axios.create({
  baseURL: 'https://www.getrevue.co/api',
  headers: {
    Authorization: `Token ${process.env.REVUE_API_KEY}`,
  },
});

export { revueApi };
