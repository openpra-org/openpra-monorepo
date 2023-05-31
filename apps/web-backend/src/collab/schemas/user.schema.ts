import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema()
class User_Credentials {
    @Prop({ required: false })
    id: number;

    @Prop({ required: false })
    username: string;
}

@Schema()
class Actions {
    @Prop({ required: false })
    tree_id: number;
    
    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    user: User_Credentials;

    @Prop({ type: mongoose.Schema.Types.Date, required: false })
    date;

    @Prop({ required: false })
    type: string;
}

@Schema()
class Type {
    @Prop({ required: false })
    'Hybrid Causal Logic': string;
}

@Schema()
class Instances {}

@Schema()
class Models {
    @Prop({ required: false })
    id: number;

    @Prop({ required: false })
    title: string;

    @Prop({ type: mongoose.Schema.Types.Date, required: false })
    date_created;

    @Prop({ type: mongoose.Schema.Types.Date, required: false })
    date_modified;

    @Prop({ required: false })
    creator: number;

    @Prop({ required: false })
    assigned_users: number[];

    @Prop({ required: false })
    description: string;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    actions: Actions[];

    @Prop({ required: false })
    path: string;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    type: Type;

    @Prop({ type: mongoose.Schema.Types.Map ,required: false })
    instances: Instances[];
}

@Schema()
class Subsystems {}

@Schema()
class Projects {}

@Schema()
class Recently_Accessed {
    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    models: Models[];

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    subsystems: Subsystems[];
    
    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    projects: Projects[];
}

@Schema()
class Configurations {}

@Schema()
class QuantificationConfigurations {
    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    configurations: Configurations;

    @Prop({ required: false })
    currentlySelected: string;
}

@Schema()
class Preferences {
    @Prop({ required: false })
    theme: string;

    @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
    nodeIdsVisible;

    @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
    outlineVisible;

    @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
    node_value_visible;

    @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
    nodeDescriptionEnabled;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    quantificationConfigurations: QuantificationConfigurations;
}

@Schema()
class Permissions {}

@Schema({
    timestamps: {
        createdAt: 'account_created',
        updatedAt: 'last_login'
    }
})
export class User {
    @Prop({ required: false })
    id: number;

    @Prop()
    first_name: string;

    @Prop()
    last_name: string;

    @Prop({ required: false })
    name: string;

    @Prop()
    username: string;

    @Prop()
    email: string;

    @Prop()
    password: string;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    recently_accessed: Recently_Accessed;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    preferences: Preferences;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    permissions: Permissions;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);