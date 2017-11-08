const axios = require('axios')
const Bluebird = require('bluebird')
const { get, find } = require('lodash')

const {
  grouperUsername,
  grouperPassword,
  grouperBase,
  kualiToken,
  kualiBase
} = require('config')

const groupsPath = '/grouper-ws/servicesRest/v2_2_000/groups/'
const subjectsPath = '/grouper-ws/servicesRest/v2_2_000/subjects'

async function run () {
  const response = await axios.post(
    `${grouperBase}${groupsPath}`,
    {
      WsRestFindGroupsRequest: {
        wsQueryFilter: {
          stemName: 'groups',
          queryFilterType: 'FIND_BY_STEM_NAME'
        }
      }
    },
    {
      headers: {
        'Content-Type': 'text/x-json',
        Authorization: 'Basic YmFuZGVyc29uOnBhc3N3b3Jk'
      }
    }
  )
  const grouperResults = get(response, 'data.WsFindGroupsResults.groupResults')
  const {
    data: kualiGroups
  } = await axios.get(`${kualiBase}/api/v1/groups/?limit=10000`, {
    headers: {
      Authorization: `Bearer ${kualiToken}`,
      'Content-Type': 'application/json'
    }
  })
  await Bluebird.map(grouperResults, async g => {
    const newGroup = {
      name: g.displayExtension,
      fields: [
        {
          id: 'grouperId',
          value: g.uuid
        }
      ]
    }
    const existingGroup = find(
      kualiGroups,
      kg => g.uuid === getField(kg, 'grouperId')
    )
    if (existingGroup) {
      await updateGroup(existingGroup, newGroup)
    } else {
      await createGroup(newGroup)
    }
  })
}

async function deleteAllGroups () {
  const {
    data: kualiGroups
  } = await axios.get(`${kualiBase}/api/v1/groups/?limit=10000`, {
    headers: {
      Authorization: `Bearer ${kualiToken}`,
      'Content-Type': 'application/json'
    }
  })
  console.log('kualiGroups.length', kualiGroups.length)
  await Bluebird.map(
    kualiGroups,
    async kg => {
      if (getField(kg, 'grouperId')) {
        const status = await deleteGroup(kg)
        console.log('status', status)
      }
    },
    { concurrency: 100 }
  )
}

function getField (group, fieldId) {
  let result
  if (group.fields) {
    const field = find(group.fields, f => f.id === fieldId)
    if (field) {
      result = field.value
    }
  }

  return result
}

async function createGroup (newGroup) {
  await axios.post(`${kualiBase}/api/v1/groups/`, newGroup, {
    headers: {
      Authorization: `Bearer ${kualiToken}`,
      'Content-Type': 'application/json'
    }
  })
}

async function deleteGroup (group) {
  const resp = await axios.delete(`${kualiBase}/api/v1/groups/${group.id}/`, {
    headers: {
      Authorization: `Bearer ${kualiToken}`,
      'Content-Type': 'application/json'
    }
  })
  // console.log('resp', resp)
  return resp.status
}

async function updateGroup (existingGroup, newGroup) {
  const updated = Object.assign({}, existingGroup, newGroup)
  await axios.put(`${kualiBase}/api/v1/groups/${updated.id}`, updated, {
    headers: {
      Authorization: `Bearer ${kualiToken}`,
      'Content-Type': 'application/json'
    }
  })
}

run()
  // deleteAllGroups()
  .then(result => console.log(result, 'Viskas'))
  .catch(ex => console.error(ex))