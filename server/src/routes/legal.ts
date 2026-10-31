import { Router } from "express";
import { privacyIntro, privacySections, privacyUpdatedAt } from "../privacyContent.js";

const router = Router();

router.get("/privacy", (_req, res) => {
  res.render("privacy", {
    appName: "Budget Planner",
    email: "budget.planner@maciejsolutions.pl",
    updatedAt: privacyUpdatedAt,
    intro: privacyIntro,
    sections: privacySections,
  });
});

export default router;
