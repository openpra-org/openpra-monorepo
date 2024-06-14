# Permissions

For managing permissions we are using CASL.JS library for permission management. (https://casl.js.org/v6/en/)
For now only basic functionalities have been implemented but we can implement conditional checks and have complex logic
too.

## Terminology

1. Ability: CASL defines permissions as abilities
2. Action: Each ability has an action such as Create, Read, Delete and Update. Manage is a special keyword which means
   all actions
3. Subject: Each action has to be associated with a subject such as users, roles, invitations, etc. All is a special
   keyword which means all subjects

Together each ability will have a subject on which the action can be performed on.

## Frontend

The basic flow for fetching permissions is as follows:

1. There are three predefined roles in the backend wiz. admin-role, member-role and collab-role
2. When a user signs up by default he is assigned the member-role
3. We define a custom provider called as AbilityProvider which injects the DefaultAbility for everyuser intially
4. When the user logs in, the auth token will store the information about user role and update the AbilityProvider with
   the correct role information
5. Now the AbilityProvider has the correct permissions stored into it and can be used by the front end

There are two possible ways to query the abilities

## Using the Can API

By using the <Can I={} a={}> component. The can component accepts two props where "I" are the actions and "a" are the
subjects

Example usage

  ```JSX

    <Can I="create" a="users">
      <SomeComponent />
    </Can>,
  ```

In the above code block the SomeComponent will only be rendered if the user can create users or it has the permission to
create users.

## Using the function ability hook

The other way is to fetch the ability for the current user using the useContext react hook and passing in the
AbilityContext.

Example Usage

```typescript
  const ability = useContext(AbilityContext);
if (ability.can("create", "users")) {
  // Do something that only a user who can create users do
}
```


# Backend

Roles are stored in the backend mongodb. The Roles Controller files showcases the possible actions that can be done. We can create, read, delete or update roles
by calling these APIs.

Currently backend doesnt support role based access control but it should be implemented.






