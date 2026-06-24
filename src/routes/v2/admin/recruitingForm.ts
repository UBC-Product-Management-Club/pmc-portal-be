import { Request, Response, Router } from "express";
import { RecruitingFormSchema } from "../../../schema/v2/RecruitingForm";
import { createForm, getFormById, listForms } from "../../../services/RecruitingForm/RecruitingFormService";

export const recruitingFormRouter = Router();

recruitingFormRouter.post("/", async (req: Request, res: Response) => {
    const result = RecruitingFormSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.message });
    }

    try {
        const form = await createForm(result.data);
        res.status(201).json(form);
    } catch (error: any) {
        console.error("Failed to create recruiting form:", error);
        res.status(500).json({ error: error.message });
    }
});

recruitingFormRouter.get("/", async (req: Request, res: Response) => {
    try {
        const forms = await listForms();
        res.status(200).json(forms);
    } catch (error: any) {
        console.error("Failed to list recruiting forms:", error);
        res.status(500).json({ error: error.message });
    }
});

recruitingFormRouter.get("/:formId", async (req: Request, res: Response) => {
    const formId = req.params.formId;

    try {
        const form = await getFormById(formId);
        if (!form) {
            return res.status(404).json({ error: "Recruiting form not found" });
        }
        res.status(200).json(form);
    } catch (error: any) {
        console.error("Failed to fetch recruiting form:", error);
        res.status(500).json({ error: error.message });
    }
});
