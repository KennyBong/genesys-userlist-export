let usersData = [];

window.onload = function () {

    document
        .getElementById("loadBtn")
        .addEventListener(
            "click",
            loadEverything
        );

    document
        .getElementById("searchBox")
        .addEventListener(
            "keyup",
            filterUsers
        );

    document
        .getElementById("exportBtn")
        .addEventListener(
            "click",
            exportCSV
        );
};

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(
            resolve,
            ms
        )
    );
}

async function apiGet(endpoint) {

    const region =
        document
            .getElementById("region")
            .value
            .trim();

    const token =
        document
            .getElementById("token")
            .value
            .trim();

    if (!region) {

        throw new Error(
            "Region is required."
        );
    }

    if (!token) {

        throw new Error(
            "Bearer token is required."
        );
    }

    const response =
        await fetch(
            `https://api.${region}${endpoint}`,
            {
                method: "GET",
                headers: {
                    "Authorization":
                        `Bearer ${token}`,
                    "Content-Type":
                        "application/json"
                }
            }
        );

    if (response.status === 429) {

        console.warn(
            "429 received. Waiting 5 seconds..."
        );

        await sleep(5000);

        return apiGet(
            endpoint
        );
    }

    if (!response.ok) {

        const error =
            await response.text();

        throw new Error(
            `${response.status} - ${error}`
        );
    }

    return await response.json();
}

async function getAllUsers() {

    let users = [];

    let page = 1;

    let hasNext = true;

    while (hasNext) {

        console.log(
            `Users Page ${page}`
        );

        const result =
            await apiGet(
                `/api/v2/users?pageSize=100&pageNumber=${page}`
            );

        users.push(
            ...(result.entities || [])
        );

        hasNext =
            result.nextUri != null;

        page++;
    }

    return users;
}

async function getAllGroups() {

    let groups = [];

    let page = 1;

    let hasNext = true;

    while (hasNext) {

        console.log(
            `Groups Page ${page}`
        );

        const result =
            await apiGet(
                `/api/v2/groups?pageSize=100&pageNumber=${page}`
            );

        groups.push(
            ...(result.entities || [])
        );

        hasNext =
            result.nextUri != null;

        page++;
    }

    return groups;
}

async function getGroupMembers(groupId) {

    let members = [];

    let page = 1;

    let hasNext = true;

    while (hasNext) {

        const result =
            await apiGet(
                `/api/v2/groups/${groupId}/members?pageSize=100&pageNumber=${page}`
            );

        members.push(
            ...(result.entities || [])
        );

        hasNext =
            result.nextUri != null;

        page++;
    }

    return members;
}

async function buildUserGroupMap() {

    const groups =
        await getAllGroups();

    const userGroupMap = {};

    for (
        let i = 0;
        i < groups.length;
        i++
    ) {

        const group =
            groups[i];

        console.log(
            `Group ${i + 1}/${groups.length}: ${group.name}`
        );

        try {

            const members =
                await getGroupMembers(
                    group.id
                );

            members.forEach(
                member => {

                    if (
                        !userGroupMap[
                            member.id
                        ]
                    ) {

                        userGroupMap[
                            member.id
                        ] = [];
                    }

                    userGroupMap[
                        member.id
                    ].push(
                        group.name
                    );
                }
            );
        }
        catch (error) {

            console.error(
                error
            );
        }

        await sleep(
            150
        );
    }

    return userGroupMap;
}

async function getUserAuthorization(userId) {

    try {

        const result =
            await apiGet(
                `/api/v2/authorization/subjects/${userId}`
            );

        const roleAssignments =
            [];

        const permissions =
            new Set();

        (
            result.grants || []
        ).forEach(
            grant => {

                const roleName =
                    grant.role?.name
                    || "Unknown";

                let divisionName =
                    "Unknown";

                if (
                    grant.division?.id === "*"
                ) {

                    divisionName =
                        "All Divisions";
                }
                else {

                    divisionName =
                        grant.division?.name
                        || "Unknown";
                }

                roleAssignments.push(
                    `${roleName} [${divisionName}]`
                );

                (
                    grant.role?.policies
                    || []
                ).forEach(
                    policy => {

                        permissions.add(
                            `${policy.domain}:${policy.entityName}`
                        );
                    }
                );
            }
        );

        return {

            roles:
                roleAssignments.join(
                    ", "
                ),

            permissionCount:
                permissions.size
        };

    }
    catch (error) {

        console.error(
            error
        );

        return {

            roles: "",

            permissionCount: 0
        };
    }
}

async function loadEverything() {

    try {

        console.log(
            "Load button clicked"
        );

        document.body.style.cursor =
            "wait";

        usersData =
            await getAllUsers();

        const groupMap =
            await buildUserGroupMap();

        let counter = 0;

        for (
            const user of usersData
        ) {

            counter++;

            document
                .getElementById(
                    "userCount"
                )
                .innerText =
                `Processing ${counter}/${usersData.length}`;

            const auth =
                await getUserAuthorization(
                    user.id
                );

            user.roles =
                auth.roles;

            user.permissionCount =
                auth.permissionCount;

            user.groups =
                groupMap[
                    user.id
                ]
                    ? groupMap[
                        user.id
                    ].join(", ")
                    : "";

            await sleep(
                100
            );
        }

        renderUsers(
            usersData
        );

        document
            .getElementById(
                "userCount"
            )
            .innerText =
            `Total Users: ${usersData.length}`;

    }
    catch (error) {

        console.error(
            error
        );

        alert(
            error.message
        );
    }
    finally {

        document.body.style.cursor =
            "default";
    }
}

function renderUsers(users) {

    const tbody =
        document.getElementById(
            "userTableBody"
        );

    tbody.innerHTML = "";

    users.forEach((user, index) => {

        const roleHtml =
            (user.roles || "")
                .split(", ")
                .filter(x => x)
                .map(
                    x =>
                    `<div class="role-item">${x}</div>`
                )
                .join("");

        const groupHtml =
            (user.groups || "")
                .split(", ")
                .filter(x => x)
                .map(
                    x =>
                    `<div class="group-item">${x}</div>`
                )
                .join("");

        tbody.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td>${user.name || ""}</td>
            <td>${user.email || ""}</td>
            <td>${user.division?.name || ""}</td>
            <td>${roleHtml}</td>
            <td>${groupHtml}</td>
            <td>${user.permissionCount || 0}</td>
        </tr>
        `;
    });
}
function filterUsers() {

    const keyword =
        document
            .getElementById(
                "searchBox"
            )
            .value
            .toLowerCase();

    const filtered =
        usersData.filter(
            user =>

                JSON.stringify(
                    user
                )
                .toLowerCase()
                .includes(
                    keyword
                )
        );

    renderUsers(
        filtered
    );
}

function exportCSV() {

    let csv =
        "Name,Email,Division,Role Assignments,Groups,Permission Count\n";

    usersData.forEach(
        user => {

            csv +=
                `"${user.name || ""}",` +
                `"${user.email || ""}",` +
                `"${user.division?.name || ""}",` +
                `"${(user.roles || "").replace(/"/g, '""')}",` +
                `"${(user.groups || "").replace(/"/g, '""')}",` +
                `"${user.permissionCount || 0}"\n`;
        }
    );

    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        URL.createObjectURL(
            blob
        );

    link.download =
        "Genesys_Access_Audit.csv";

    link.click();
}