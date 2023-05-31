import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import pbkdf2 from 'pbkdf2-passworder';
import { CreateNewUserDto } from './dtos/create-new-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class CollabService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

    async createNewUser(body: CreateNewUserDto): Promise<User> {
        body.password = await pbkdf2.hash(body.password);
        const newUser = new this.userModel(body);
        newUser.name = `${body.first_name} ${body.last_name}`;
        newUser.recently_accessed = {
            models: [],
            subsystems: [],
            projects: []
        };
        newUser.preferences = {
            theme: 'Light',
            nodeIdsVisible: '',
            outlineVisible: '',
            node_value_visible: '',
            nodeDescriptionEnabled: '',
            quantificationConfigurations: {
                configurations: {},
                currentlySelected: ' '
            }
        };
        newUser.permissions = {};
        return newUser.save();
    }

    async loginUser(username: string): Promise<User | undefined> {
        return this.userModel.findOne({ username });
    }
}
