import { Router } from 'express';
import { oauthService } from '../services/OAuthService';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const data = await oauthService.login(req.body.name, req.body.pass)
    res.json({ code: 0, data });
  } catch (err: any) {
    res.json({ code: -1, message: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const data = await oauthService.register(req.body)
    res.json({ code: 0, data });
  } catch (err: any) {
    res.json({ code: -1, message: err.message });
  }
})

export default router;