import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { templateService } from '../services/templateService';
import { CreateTemplateDTO, UpdateTemplateDTO, ChannelEnum } from '../models/notificationModel';

export const createTemplate = catchAsync(async (req: Request, res: Response) => {
  const templateData = CreateTemplateDTO.parse(req.body);
  const template = await templateService.create(templateData);
  
  res.status(201).json({
    status: 'success',
    data: template
  });
});

export const updateTemplate = catchAsync(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const templateData = UpdateTemplateDTO.parse(req.body);
  
  const template = await templateService.update(id, templateData);
  
  res.json({
    status: 'success',
    data: template
  });
});

export const getTemplate = catchAsync(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const template = await templateService.getById(id);
  
  if (!template) {
    res.status(404).json({
      status: 'error',
      message: 'Template not found'
    });
    return;
  }
  
  res.json({
    status: 'success',
    data: template
  });
});

export const getAllTemplates = catchAsync(async (req: Request, res: Response) => {
  const options: {
    channel?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {};
  
  if (req.query.channel) {
    const channel = req.query.channel as string;
    // Validate that the channel is a valid enum value
    if (Object.values(ChannelEnum.enum).includes(channel as any)) {
      options.channel = channel;
    }
  }
  
  if (req.query.isActive !== undefined) {
    options.isActive = req.query.isActive === 'true';
  }
  
  if (req.query.limit) {
    options.limit = parseInt(req.query.limit as string, 10);
  }
  
  if (req.query.offset) {
    options.offset = parseInt(req.query.offset as string, 10);
  }
  
  const templates = await templateService.getAll(options);
  
  res.json({
    status: 'success',
    results: templates.length,
    data: templates
  });
});

export const deleteTemplate = catchAsync(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const success = await templateService.delete(id);
  
  if (!success) {
    res.status(404).json({
      status: 'error',
      message: 'Template not found'
    });
    return;
  }
  
  res.status(204).send();
});

export const templateController = {
  createTemplate,
  updateTemplate,
  getTemplate,
  getAllTemplates,
  deleteTemplate
};
