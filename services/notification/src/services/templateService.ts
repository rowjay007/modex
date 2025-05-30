import { eq } from 'drizzle-orm';
import { db, sql } from '../config/database';
// Use any type for db to fix Drizzle TypeScript errors
const typedDb = db as any;
import { templates as schemaTemplates } from '../models/schema';
// Use any type for templates to fix Drizzle TypeScript errors
const templates = schemaTemplates as any;
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { 
  Template, 
  CreateTemplateDTO, 
  UpdateTemplateDTO 
} from '../models/notificationModel';

export async function createTemplate(templateData: CreateTemplateDTO): Promise<Template> {
  try {
    // Check if template with same name already exists
    const existingTemplate = await typedDb.query.templates.findFirst({
      where: eq(templates.name, templateData.name)
    });
    
    if (existingTemplate) {
      throw new AppError(400, `Template with name '${templateData.name}' already exists`);
    }
    
    const [dbTemplate] = await typedDb.insert(templates).values({
      name: templateData.name,
      description: templateData.description || null,
      channel: templateData.channel,
      subject: templateData.subject || null,
      content: templateData.content,
      variables: templateData.variables || null,
      isActive: templateData.isActive !== undefined ? templateData.isActive : true
    }).returning();
    
    // Ensure isActive is always a boolean
    const template: Template = {
      ...dbTemplate,
      isActive: dbTemplate.isActive === null ? true : !!dbTemplate.isActive
    };
    
    return template;
  } catch (error: any) {
    logger.error('Failed to create template', { templateData, error });
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(500, `Failed to create template: ${error.message || 'Unknown error'}`);
  }
}

export async function updateTemplate(id: number, templateData: UpdateTemplateDTO): Promise<Template> {
  try {
    // Check if template exists
    const existingTemplate = await getTemplateById(id);
    
    if (!existingTemplate) {
      throw new AppError(404, 'Template not found');
    }
    
    // Check if new name conflicts with another template
    if (templateData.name && templateData.name !== existingTemplate.name) {
      const nameConflict = await typedDb.query.templates.findFirst({
        where: eq(templates.name, templateData.name)
      });
      
      if (nameConflict) {
        throw new AppError(400, `Template with name '${templateData.name}' already exists`);
      }
    }
    
    // Update template
    const [dbUpdatedTemplate] = await typedDb
      .update(templates)
      .set({
        ...templateData,
        updatedAt: new Date()
      })
      .where(eq(templates.id, id))
      .returning();
      
    // Ensure isActive is always a boolean
    const updatedTemplate: Template = {
      ...dbUpdatedTemplate,
      isActive: dbUpdatedTemplate.isActive === null ? true : !!dbUpdatedTemplate.isActive
    };
      
    return updatedTemplate;
  } catch (error: any) {
    logger.error('Failed to update template', { id, templateData, error });
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new AppError(500, `Failed to update template: ${error.message}`);
    }
    throw new AppError(500, 'Failed to update template due to an unknown error');
  }
}

export async function getTemplateById(id: number): Promise<Template | null> {
  try {
    const dbTemplate = await typedDb.query.templates.findFirst({
      where: eq(templates.id, id)
    });
    
    if (!dbTemplate) return null;
    
    // Ensure isActive is always a boolean
    const template: Template = {
      ...dbTemplate,
      isActive: dbTemplate.isActive === null ? true : !!dbTemplate.isActive
    };
    
    return template;
  } catch (error: any) {
    logger.error('Failed to get template', { id, error });
    if (error instanceof Error) {
      throw new AppError(500, `Failed to get template: ${error.message}`);
    }
    throw new AppError(500, 'Failed to get template due to an unknown error');
  }
}

export async function getAllTemplates(options: { 
  channel?: string; 
  isActive?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<Template[]> {
  try {
    const { channel, isActive, limit = 50, offset = 0 } = options;
    
    // Create a simple array to store templates
    let dbTemplateList: any[] = [];
    
    // Use the postgres-js client directly for this query
    // This bypasses drizzle's type constraints
    
    // Build conditions for the SQL query
    const conditions: string[] = [];
    
    if (channel) {
      conditions.push(`channel = '${channel}'`);
    }
    
    if (isActive !== undefined) {
      conditions.push(`is_active = ${isActive}`);
    }
    
    // Construct the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Execute the query with proper pagination
    dbTemplateList = await sql`
      SELECT * FROM notification_templates
      ${sql.unsafe(whereClause)}
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    // Ensure isActive is always a boolean in all templates
    const templateList: Template[] = dbTemplateList.map((template: any) => ({
      ...template,
      isActive: template.isActive === null ? true : !!template.isActive,
      novuTemplateId: template.novuTemplateId || null
    }));
    
    return templateList;
  } catch (error: any) {
    logger.error('Failed to get templates', { options, error });
    if (error instanceof Error) {
      throw new AppError(500, `Failed to get templates: ${error.message}`);
    }
    throw new AppError(500, 'Failed to get templates due to an unknown error');
  }
}

export async function deleteTemplate(id: number): Promise<boolean> {
  try {
    // Instead of actual deletion, we'll set isActive to false
    const [deactivatedTemplate] = await typedDb
      .update(templates)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(templates.id, id))
      .returning();
    
    return !!deactivatedTemplate;
  } catch (error: any) {
    logger.error('Failed to delete template', { id, error });
    if (error instanceof Error) {
      throw new AppError(500, `Failed to delete template: ${error.message}`);
    }
    throw new AppError(500, 'Failed to delete template due to an unknown error');
  }
}

export const templateService = {
  create: createTemplate,
  update: updateTemplate,
  getById: getTemplateById,
  getAll: getAllTemplates,
  delete: deleteTemplate
};
